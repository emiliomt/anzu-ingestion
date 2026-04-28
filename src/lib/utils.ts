import { v4 as uuidv4 } from "uuid";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely — used by all shadcn/ui components */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a human-readable reference number like AZ-2024-A1B2C3 */
export function generateReferenceNo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = uuidv4().replace(/-/g, "").toUpperCase().slice(0, 6);
  return `AZ-${year}-${random}`;
}

/** Parse a JSON string safely, returning a default on failure */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/** Return MIME type label */
export function mimeLabel(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/xml": "XML",
    "text/xml": "XML",
    "application/zip": "ZIP",
    "application/x-zip-compressed": "ZIP",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/heic": "HEIC",
    "image/tiff": "TIFF",
    "image/webp": "WebP",
  };
  return map[mime] ?? mime;
}

/** Format file size to human-readable */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Confidence level label */
export function confidenceLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 0.95) return "High";
  if (score >= 0.85) return "Medium";
  return "Low";
}

/** Confidence badge color class */
export function confidenceColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 0.95) return "text-green-600";
  if (score >= 0.85) return "text-yellow-600";
  return "text-red-600";
}

/** Check if a MIME type is acceptable */
export type InvoiceFileKind = "pdf" | "xml" | "image" | "zip" | "unsupported";

const XML_MIMES = new Set(["application/xml", "text/xml"]);
const PDF_MIMES = new Set(["application/pdf"]);
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/tif",
  "image/webp",
]);
const ZIP_MIMES = new Set(["application/zip", "application/x-zip-compressed"]);

function canonicalInvoiceMime(mime: string): string | null {
  if (PDF_MIMES.has(mime)) return "application/pdf";
  if (XML_MIMES.has(mime)) return "application/xml";
  if (IMAGE_MIMES.has(mime)) {
    if (mime === "image/jpg" || mime === "image/jpeg") return "image/jpeg";
    if (mime === "image/heif" || mime === "image/heic") return "image/heic";
    if (mime === "image/tif" || mime === "image/tiff") return "image/tiff";
    return mime;
  }
  if (ZIP_MIMES.has(mime)) return "application/zip";
  return null;
}

export function inferMimeFromFileName(name: string): string | null {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".tiff") || lower.endsWith(".tif")) return "image/tiff";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".zip")) return "application/zip";
  return null;
}

export function classifyInvoiceFile(
  mime: string,
  fileName = ""
): { kind: InvoiceFileKind; mimeType: string | null } {
  const normalized = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  const canonicalMime = canonicalInvoiceMime(normalized);
  const fallbackMime = inferMimeFromFileName(fileName);
  const resolvedMime = canonicalMime ?? fallbackMime;

  if (!resolvedMime) {
    return { kind: "unsupported", mimeType: null };
  }
  if (resolvedMime === "application/pdf") {
    return { kind: "pdf", mimeType: resolvedMime };
  }
  if (resolvedMime === "application/xml") {
    return { kind: "xml", mimeType: resolvedMime };
  }
  if (resolvedMime === "application/zip") {
    return { kind: "zip", mimeType: resolvedMime };
  }
  return { kind: "image", mimeType: resolvedMime };
}

export function isValidMime(mime: string, fileName = ""): boolean {
  const { kind } = classifyInvoiceFile(mime, fileName);
  return kind === "pdf" || kind === "image" || kind === "xml";
}

/** True when mime type represents a ZIP archive */
export function isZipMime(mime: string, fileName = ""): boolean {
  return classifyInvoiceFile(mime, fileName).kind === "zip";
}

/** Convert bytes to base64 (Node Buffer respects byteOffset; raw ArrayBuffer does not) */
export function bufferToBase64(data: ArrayBuffer | Buffer): string {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return data.toString("base64");
  }
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Map MIME type to Anthropic-compatible media type */
export function toAnthropicMediaType(
  mime: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf" {
  if (mime === "application/pdf") return "application/pdf";
  if (mime.includes("png")) return "image/png";
  if (mime.includes("webp")) return "image/webp";
  return "image/jpeg"; // default for jpg, heic, tiff (converted by sharp if needed)
}
