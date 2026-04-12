import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const STORAGE_TYPE = (process.env.STORAGE_TYPE ?? "local") as "local" | "s3";
const STORAGE_PATH = process.env.STORAGE_PATH ?? "./uploads";
const S3_BUCKET   = process.env.AWS_BUCKET_NAME ?? "";
const S3_REGION   = process.env.AWS_REGION ?? "auto";
// Optional custom endpoint — required for Cloudflare R2 and other S3-compatible providers.
// Set S3_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com for R2.
// Leave unset for standard AWS S3.
const S3_ENDPOINT = process.env.S3_ENDPOINT_URL ?? undefined;

export interface StoredFile {
  key: string;      // year/month/channel/uuid.ext
  url: string;      // local path OR s3://bucket/key
  fileName: string;
  mimeType: string;
  fileSize: number;
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/tiff": "tiff",
    "image/webp": "webp",
  };
  return map[mime] ?? "bin";
}

/** Store a file — routes to S3 or local depending on STORAGE_TYPE env var */
export async function storeFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  channel: string
): Promise<StoredFile> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const ext = extFromMime(mimeType);
  const uuid = uuidv4();
  const key = `${year}/${month}/${channel}/${uuid}.${ext}`;

  if (STORAGE_TYPE === "s3" && S3_BUCKET) {
    return storeToS3(buffer, key, originalName, mimeType);
  }
  return storeLocal(buffer, key, originalName, mimeType);
}

async function storeLocal(
  buffer: Buffer,
  key: string,
  originalName: string,
  mimeType: string
): Promise<StoredFile> {
  const fullPath = path.join(STORAGE_PATH, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return { key, url: fullPath, fileName: originalName, mimeType, fileSize: buffer.length };
}

async function storeToS3(
  buffer: Buffer,
  key: string,
  originalName: string,
  mimeType: string
): Promise<StoredFile> {
  // Lazy-load AWS SDK so it's tree-shaken when not used
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: S3_REGION,
    // endpoint is required for Cloudflare R2 and other S3-compatible providers
    ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {}),
    // R2 requires path-style URLs; harmless for AWS
    forcePathStyle: !!S3_ENDPOINT,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ContentDisposition: `inline; filename="${originalName}"`,
    })
  );

  return {
    key,
    url: `s3://${S3_BUCKET}/${key}`,
    fileName: originalName,
    mimeType,
    fileSize: buffer.length,
  };
}

/** Shared S3Client config — reads the same env vars used by storeToS3 */
function makeS3Client() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { S3Client } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
  return new S3Client({
    region: S3_REGION,
    ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {}),
    forcePathStyle: !!S3_ENDPOINT,
  });
}

/** Read a file from storage (local filesystem or S3) */
export async function readFile(fileUrl: string): Promise<Buffer> {
  if (fileUrl.startsWith("s3://")) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = makeS3Client();
    const { bucket, key } = parseS3Url(fileUrl);

    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  return fs.readFile(fileUrl);
}

/** Returns a URL suitable for the browser to fetch the file */
export function getServeUrl(fileUrl: string): string {
  // Use a relative URL so it resolves correctly on any domain (Railway, Vercel, localhost, etc.)
  if (fileUrl.startsWith("s3://")) {
    return `/api/files?s3=${encodeURIComponent(fileUrl)}`;
  }
  return `/api/files?path=${encodeURIComponent(fileUrl)}`;
}

/** Generate a presigned S3 URL (1-hour expiry). Falls back to API route for local. */
export async function getPresignedUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  if (fileUrl.startsWith("s3://")) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = makeS3Client();
    const { bucket, key } = parseS3Url(fileUrl);

    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn }
    );
  }
  return getServeUrl(fileUrl);
}

function parseS3Url(s3Url: string): { bucket: string; key: string } {
  const withoutPrefix = s3Url.slice("s3://".length);
  const slashIdx = withoutPrefix.indexOf("/");
  if (slashIdx === -1) {
    throw new Error(`Invalid S3 URL — missing key path: "${s3Url}"`);
  }
  return {
    bucket: withoutPrefix.slice(0, slashIdx),
    key: withoutPrefix.slice(slashIdx + 1),
  };
}
