import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
};

/**
 * GET /api/files
 * Serves stored invoice files.
 *
 * Query params:
 *   ?path=<local-path>   — serve from local filesystem (dev / Railway)
 *   ?s3=<s3://...>       — redirect to a presigned S3 URL (production)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const s3Url = searchParams.get("s3");
  const filePath = searchParams.get("path");

  // S3 mode: redirect to a fresh presigned URL
  if (s3Url) {
    try {
      const { getPresignedUrl } = await import("@/lib/storage");
      const presigned = await getPresignedUrl(decodeURIComponent(s3Url));
      return NextResponse.redirect(presigned);
    } catch {
      return NextResponse.json({ error: "Failed to generate file URL" }, { status: 500 });
    }
  }

  // Local mode: read and stream the file
  if (!filePath) {
    return NextResponse.json({ error: "No path provided" }, { status: 400 });
  }

  // Security: file must resolve within the configured storage directory
  const storagePath = process.env.STORAGE_PATH ?? "./uploads";
  const absoluteStorage = path.resolve(storagePath);
  const absoluteFile = path.resolve(filePath);

  if (!absoluteFile.startsWith(absoluteStorage)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await fs.readFile(absoluteFile);
    const ext = path.extname(absoluteFile).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
