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
export function isValidMime(mime: string): boolean {
  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/tiff",
    "image/webp",
    // Colombian UBL XML electronic invoices
    "text/xml",
    "application/xml",
  ];
  return allowed.includes(mime);
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
