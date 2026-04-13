// Anzu Dynamics — ZIP Invoice Upload API
// POST /api/upload/unzip — accepts a single .zip file, extracts its contents,
// and processes each valid invoice file (PDF/image/XML) as a separate invoice.
// Returns the same { results } shape as /api/upload, plus a { skipped } list
// for entries that could not be processed (nested ZIPs, unsupported types, etc.).

import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { generateReferenceNo, isValidMime, isZipMime } from "@/lib/utils";
import { checkQuotaOrNull } from "@/lib/quota";
import { sendConfirmationEmail } from "@/lib/email";
import { scheduleBackground, processInvoice } from "@/lib/invoice-processing";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // ZIP processing needs more time than a single 10-file batch

const MAX_ZIP_SIZE = 50 * 1024 * 1024;  // 50 MB — safe on both Vercel Pro and Railway
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per contained file
const MAX_FILES_IN_ZIP = 500;           // ZIP bomb guard

/** Map file extension to MIME type (ZIP entries have no Content-Type header) */
function mimeFromExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf:  "application/pdf",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    png:  "image/png",
    heic: "image/heic",
    tiff: "image/tiff",
    tif:  "image/tiff",
    webp: "image/webp",
    xml:  "application/xml",
  };
  return map[ext] ?? null;
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const submittedBy = (formData.get("email") as string | null) ?? null;
  const submittedName = (formData.get("name") as string | null) ?? null;
  const formOrgId = (formData.get("organizationId") as string | null) ?? null;
  const zipFile = formData.get("zip") as File | null;

  if (!zipFile) {
    return NextResponse.json({ error: "No ZIP file provided" }, { status: 400 });
  }

  // Accept application/zip, application/x-zip-compressed, or octet-stream with .zip extension
  const isZip = isZipMime(zipFile.type) || zipFile.name.toLowerCase().endsWith(".zip");
  if (!isZip) {
    return NextResponse.json({ error: "File must be a ZIP archive" }, { status: 400 });
  }

  if (zipFile.size > MAX_ZIP_SIZE) {
    return NextResponse.json(
      { error: `ZIP file exceeds ${MAX_ZIP_SIZE / 1024 / 1024} MB limit` },
      { status: 400 }
    );
  }

  // Resolve organizationId
  const session = await auth();
  let organizationId: string | null = session.orgId ?? null;
  if (session.userId && !organizationId) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const { data: memberships } = await client.users.getOrganizationMembershipList({
        userId: session.userId,
        limit: 1,
      });
      if (memberships.length > 0) organizationId = memberships[0].organization.id;
    } catch {
      // ignore — fall through to form field
    }
  }
  if (!organizationId && formOrgId) organizationId = formOrgId;

  // Quota check
  try {
    const quota = await checkQuotaOrNull(organizationId);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Monthly quota exceeded. Your ${quota.plan} plan allows ${quota.limit} invoices per month. Used: ${quota.used}. Quota resets on ${new Date(quota.resetAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
          quota,
        },
        { status: 429 }
      );
    }
  } catch (quotaErr) {
    console.warn("[Unzip] quota check failed:", quotaErr);
  }

  // Parse the ZIP
  let zip: AdmZip;
  try {
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    zip = new AdmZip(zipBuffer);
  } catch {
    return NextResponse.json({ error: "Could not read ZIP file — it may be corrupt" }, { status: 400 });
  }

  // Filter and categorise entries
  const allEntries = zip.getEntries();
  const skipped: string[] = [];
  const processableEntries: AdmZip.IZipEntry[] = [];

  for (const entry of allEntries) {
    // Skip directories and macOS metadata folders
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    if (name.startsWith("__MACOSX/") || name.startsWith(".")) continue;

    // Nested ZIPs — skip with notice
    if (name.toLowerCase().endsWith(".zip")) {
      skipped.push(name);
      continue;
    }

    processableEntries.push(entry);
  }

  if (processableEntries.length === 0) {
    return NextResponse.json(
      { error: "ZIP contained no processable invoice files" },
      { status: 400 }
    );
  }

  if (processableEntries.length > MAX_FILES_IN_ZIP) {
    return NextResponse.json(
      { error: `ZIP contains too many files (max ${MAX_FILES_IN_ZIP})` },
      { status: 400 }
    );
  }

  const results: Array<{
    referenceNo: string;
    fileName: string;
    status: string;
    error?: string;
  }> = [];

  for (const entry of processableEntries) {
    // Use only the filename portion (strip subdirectory paths)
    const fileName = entry.name;

    const mime = mimeFromExtension(fileName);
    if (!mime || !isValidMime(mime)) {
      results.push({
        referenceNo: "",
        fileName,
        status: "error",
        error: `Unsupported file type: ${fileName.split(".").pop() ?? "unknown"}`,
      });
      continue;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = entry.getData();
    } catch {
      results.push({ referenceNo: "", fileName, status: "error", error: "Could not read file from ZIP" });
      continue;
    }

    if (fileBuffer.length > MAX_FILE_SIZE) {
      results.push({ referenceNo: "", fileName, status: "error", error: "File exceeds 20 MB limit" });
      continue;
    }

    if (fileBuffer.length === 0) {
      results.push({ referenceNo: "", fileName, status: "error", error: "File is empty" });
      continue;
    }

    try {
      const stored = await storeFile(fileBuffer, fileName, mime, "web");
      const referenceNo = generateReferenceNo();

      const invoice = await prisma.invoice.create({
        data: {
          referenceNo,
          channel: "web",
          status: "processing",
          fileUrl: stored.url,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          fileSize: stored.fileSize,
          submittedBy,
          submittedName,
          vendorId: null,
          ...(organizationId ? { organizationId } : {}),
        },
      });

      await prisma.ingestionEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "received",
          metadata: JSON.stringify({
            channel: "web",
            fileName,
            submittedBy,
            source: "zip",
            zipName: zipFile.name,
          }),
        },
      });

      scheduleBackground(
        processInvoice(invoice.id, referenceNo, fileBuffer, stored.mimeType, submittedBy, organizationId).catch(async (err) => {
          console.error(`[Extract] Failed for invoice ${invoice.id}:`, err);
          try {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: "error", flags: JSON.stringify(["extraction_failed"]) },
            });
          } catch (updateErr) {
            console.error(`[Extract] Failed to mark invoice ${invoice.id} as error:`, updateErr);
          }
        })
      );

      results.push({ referenceNo, fileName, status: "received" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Unzip] Error processing "${fileName}":`, msg);
      results.push({ referenceNo: "", fileName, status: "error", error: "Processing failed. Please try again." });
    }
  }

  // Send one confirmation email for the first successfully queued invoice
  if (submittedBy && results.some((r) => r.status === "received")) {
    const firstSuccess = results.find((r) => r.status === "received");
    if (firstSuccess) {
      sendConfirmationEmail({
        to: submittedBy,
        referenceNo: firstSuccess.referenceNo,
      }).catch((err) => console.error("[Email]", err));
    }
  }

  return NextResponse.json({ results, skipped });
}
