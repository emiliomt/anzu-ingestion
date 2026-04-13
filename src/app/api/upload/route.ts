// Anzu Dynamics — Invoice Upload API
// POST /api/upload — accepts multipart form-data with invoice files (PDF/image/XML).
// Public route (no auth required) for vendor portal uploads.
// When called by an authenticated user, injects their organizationId.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { generateReferenceNo, isValidMime } from "@/lib/utils";
import { checkQuotaOrNull } from "@/lib/quota";
import { sendConfirmationEmail } from "@/lib/email";
import { scheduleBackground, processInvoice } from "@/lib/invoice-processing";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — raise to 300 on Vercel Pro if needed

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const submittedBy = (formData.get("email") as string | null) ?? null;
  const submittedName = (formData.get("name") as string | null) ?? null;
  const files = formData.getAll("files") as File[];
  // org ID optionally embedded in portal URL and forwarded as a hidden form field
  const formOrgId = (formData.get("organizationId") as string | null) ?? null;

  // Resolve organizationId: JWT → Clerk API fallback → form field (vendor portal with ?org=)
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

  // Enforce per-org monthly quota (unauthenticated uploads are always allowed).
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
    console.warn("[Upload] quota check failed (schema may be out of sync):", quotaErr);
  }

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files per upload` },
      { status: 400 }
    );
  }

  const results: Array<{
    referenceNo: string;
    fileName: string;
    status: string;
    error?: string;
  }> = [];

  for (const file of files) {
    try {
      if (!isValidMime(file.type)) {
        results.push({
          referenceNo: "",
          fileName: file.name,
          status: "error",
          error: `Unsupported file type: ${file.type}`,
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        results.push({
          referenceNo: "",
          fileName: file.name,
          status: "error",
          error: "File exceeds 20 MB limit",
        });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storeFile(buffer, file.name, file.type, "web");
      const referenceNo = generateReferenceNo();

      let vendorId: string | null = null;

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
          vendorId,
          ...(organizationId ? { organizationId } : {}),
        },
      });

      await prisma.ingestionEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "received",
          metadata: JSON.stringify({
            channel: "web",
            fileName: file.name,
            submittedBy,
          }),
        },
      });

      scheduleBackground(
        processInvoice(invoice.id, referenceNo, buffer, stored.mimeType, submittedBy, organizationId).catch(async (err) => {
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

      results.push({ referenceNo, fileName: file.name, status: "received" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Upload] Error processing file "${file.name}":`, msg, err);
      results.push({
        referenceNo: "",
        fileName: file.name,
        status: "error",
        error: "Processing failed. Please try again.",
      });
    }
  }

  if (submittedBy && results.some((r) => r.status === "received")) {
    const firstSuccess = results.find((r) => r.status === "received");
    if (firstSuccess) {
      sendConfirmationEmail({
        to: submittedBy,
        referenceNo: firstSuccess.referenceNo,
      }).catch((err) => console.error("[Email]", err));
    }
  }

  return NextResponse.json({ results });
}
