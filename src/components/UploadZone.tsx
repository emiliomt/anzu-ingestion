"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, Archive, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  referenceNo?: string;
  error?: string;
  isZip?: boolean;
}

interface UploadZoneProps {
  onUploadComplete?: (references: string[]) => void;
  /** Pre-fill email when a signed-in provider submits */
  prefilledEmail?: string;
  /** Org ID embedded in the portal URL — tags vendor uploads to the correct tenant */
  organizationId?: string;
}

type ResultItem = { referenceNo: string; fileName: string; status: string; error?: string };

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.heic,.tiff,.webp,.zip";
const MAX_SIZE = 20 * 1024 * 1024;
const BATCH_SIZE = 10; // files per request to /api/upload

function isZipFile(f: File): boolean {
  return (
    f.type === "application/zip" ||
    f.type === "application/x-zip-compressed" ||
    f.type === "application/x-zip" ||
    f.name.toLowerCase().endsWith(".zip")
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export function UploadZone({ onUploadComplete, prefilledEmail = "", organizationId }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [email, setEmail] = useState(prefilledEmail);
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successRefs, setSuccessRefs] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    filesUploaded: number;
    filesTotal: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);

    // Check if the incoming set contains a ZIP mixed with other files
    const zips = arr.filter(isZipFile);
    const nonZips = arr.filter((f) => !isZipFile(f));

    const mapped: UploadFile[] = [];

    if (zips.length > 0 && nonZips.length > 0) {
      // Mixed ZIP + regular files — reject the ZIPs with an error
      zips.forEach((f) => mapped.push({
        file: f,
        id: Math.random().toString(36).slice(2),
        status: "error",
        isZip: true,
        error: "Upload ZIP files separately from other files",
      }));
      nonZips.forEach((f) => mapped.push({
        file: f,
        id: Math.random().toString(36).slice(2),
        status: "pending",
        error: f.size > MAX_SIZE ? "File exceeds 20 MB limit" : undefined,
      }));
    } else if (zips.length > 0 && nonZips.length === 0) {
      // ZIP-only drop — only accept the first ZIP (one at a time)
      const firstZip = zips[0];
      mapped.push({
        file: firstZip,
        id: Math.random().toString(36).slice(2),
        status: "pending",
        isZip: true,
      });
      if (zips.length > 1) {
        zips.slice(1).forEach((f) => mapped.push({
          file: f,
          id: Math.random().toString(36).slice(2),
          status: "error",
          isZip: true,
          error: "Upload one ZIP at a time",
        }));
      }
    } else {
      // Regular files only — no total count cap
      arr.forEach((f) => mapped.push({
        file: f,
        id: Math.random().toString(36).slice(2),
        status: "pending",
        error: f.size > MAX_SIZE ? "File exceeds 20 MB limit" : undefined,
      }));
    }

    setFiles((prev) => [...prev, ...mapped]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  /** Upload a ZIP file to /api/upload/unzip */
  const handleZipUpload = async (zipFile: UploadFile) => {
    setIsUploading(true);
    setFiles((prev) => prev.map((f) => f.id === zipFile.id ? { ...f, status: "uploading" } : f));

    const formData = new FormData();
    formData.append("zip", zipFile.file);
    if (email) formData.append("email", email);
    if (name) formData.append("name", name);
    if (organizationId) formData.append("organizationId", organizationId);

    try {
      const res = await fetch("/api/upload/unzip", { method: "POST", body: formData });
      const data = await res.json() as {
        results?: ResultItem[];
        skipped?: string[];
        error?: string;
      };

      if (!res.ok || !data.results) {
        setFiles((prev) => prev.map((f) =>
          f.id === zipFile.id ? { ...f, status: "error", error: data.error ?? "ZIP upload failed" } : f
        ));
        return;
      }

      const refs = data.results.filter((r) => r.status === "received").map((r) => r.referenceNo);
      const allFailed = refs.length === 0;

      setFiles((prev) => prev.map((f) =>
        f.id === zipFile.id
          ? {
              ...f,
              status: allFailed ? "error" : "success",
              error: allFailed ? "No files could be processed from this ZIP" : undefined,
            }
          : f
      ));

      if (refs.length > 0) {
        setSuccessRefs(refs);
        setSubmitted(true);
        onUploadComplete?.(refs);
      }
    } catch {
      setFiles((prev) => prev.map((f) =>
        f.id === zipFile.id ? { ...f, status: "error", error: "Upload failed" } : f
      ));
    } finally {
      setIsUploading(false);
    }
  };

  /** Upload regular files to /api/upload in sequential batches of BATCH_SIZE */
  const handleBatchUpload = async (validFiles: UploadFile[]) => {
    const batches = chunk(validFiles, BATCH_SIZE);
    setBatchProgress({ current: 0, total: batches.length, filesUploaded: 0, filesTotal: validFiles.length });
    setIsUploading(true);
    const allRefs: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      setBatchProgress((prev) => prev ? { ...prev, current: i + 1 } : null);

      setFiles((prev) => prev.map((f) =>
        batch.some((b) => b.id === f.id) ? { ...f, status: "uploading" } : f
      ));

      const formData = new FormData();
      if (email) formData.append("email", email);
      if (name) formData.append("name", name);
      if (organizationId) formData.append("organizationId", organizationId);
      batch.forEach((f) => formData.append("files", f.file));

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json() as { results?: ResultItem[]; error?: string };

        if (res.status === 429) {
          // Quota exhausted — mark this batch and all remaining pending files
          setFiles((prev) => prev.map((f) => {
            if (batch.some((b) => b.id === f.id) || f.status === "pending") {
              return { ...f, status: "error", error: data.error ?? "Quota exceeded" };
            }
            return f;
          }));
          break; // stop sending further batches
        }

        if (!res.ok || !data.results) {
          setFiles((prev) => prev.map((f) =>
            batch.some((b) => b.id === f.id)
              ? { ...f, status: "error", error: data.error ?? "Upload failed" }
              : f
          ));
          continue; // proceed to next batch
        }

        setFiles((prev) => prev.map((f) => {
          const result = data.results!.find((r) => r.fileName === f.file.name);
          if (result && batch.some((b) => b.id === f.id)) {
            if (result.status === "received") allRefs.push(result.referenceNo);
            return {
              ...f,
              status: result.status === "received" ? "success" : "error",
              referenceNo: result.referenceNo,
              error: result.error,
            };
          }
          return f;
        }));

        setBatchProgress((prev) =>
          prev ? { ...prev, filesUploaded: prev.filesUploaded + batch.length } : null
        );
      } catch {
        setFiles((prev) => prev.map((f) =>
          batch.some((b) => b.id === f.id) ? { ...f, status: "error", error: "Upload failed" } : f
        ));
      }
    }

    setBatchProgress(null);
    setIsUploading(false);
    if (allRefs.length > 0) {
      setSuccessRefs(allRefs);
      setSubmitted(true);
      onUploadComplete?.(allRefs);
    }
  };

  const handleUpload = async () => {
    const validFiles = files.filter((f) => !f.error && f.status === "pending");
    if (validFiles.length === 0) return;

    // ZIP mode: exactly one ZIP file queued
    if (validFiles.length === 1 && validFiles[0].isZip) {
      await handleZipUpload(validFiles[0]);
      return;
    }

    await handleBatchUpload(validFiles);
  };

  const pendingCount = files.filter((f) => f.status === "pending" && !f.error).length;

  if (submitted && successRefs.length > 0) {
    return (
      <div className="card p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">
          {successRefs.length === 1 ? "Invoice Received!" : `${successRefs.length} Invoices Received!`}
        </h3>
        <p className="text-gray-500">
          {successRefs.length === 1
            ? "Your invoice has been received and is being processed."
            : `All ${successRefs.length} invoices have been received and are being processed.`}
          {email && " A confirmation email is on its way."}
        </p>
        <div className="bg-indigo-50 rounded-lg p-4 max-h-48 overflow-y-auto">
          {successRefs.map((ref) => (
            <div key={ref} className="mb-2 last:mb-0">
              <p className="text-xs text-indigo-500 uppercase tracking-wider">Reference Number</p>
              <p className="text-lg font-bold text-indigo-700 tracking-wider">{ref}</p>
            </div>
          ))}
        </div>
        {successRefs.length <= 5 && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {successRefs.map((ref) => (
              <a key={ref} href={`/status/${ref}`} className="btn-secondary text-sm justify-center">
                Track {ref} →
              </a>
            ))}
          </div>
        )}
        <button
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          onClick={() => {
            setFiles([]);
            setSubmitted(false);
            setSuccessRefs([]);
            setEmail("");
            setName("");
          }}
        >
          Submit more invoices
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
          ${isDragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Upload className="w-7 h-7 text-indigo-600" />
        </div>
        <p className="text-base font-medium text-gray-700 mb-1">
          Drop invoices here or <span className="text-indigo-600">browse</span>
        </p>
        <p className="text-sm text-gray-400">
          PDF, PNG, JPG, HEIC, TIFF, WebP · ZIP archive · Max 20 MB per file
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100"
            >
              {f.isZip
                ? <Archive className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                : <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{f.file.name}</p>
                {f.isZip && f.status === "pending" && !f.error && (
                  <p className="text-xs text-indigo-400">Will be extracted server-side</p>
                )}
                {f.error && (
                  <p className="text-xs text-red-500">{f.error}</p>
                )}
                {f.referenceNo && f.status === "success" && (
                  <p className="text-xs text-green-600">Ref: {f.referenceNo}</p>
                )}
              </div>
              {f.status === "pending" && !f.error && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  className="text-gray-300 hover:text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {f.status === "success" && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
              {f.status === "error" && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
              {f.status === "uploading" && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />}
            </li>
          ))}
        </ul>
      )}

      {/* Provider info */}
      {files.length > 0 && (
        <div className="card p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Contact info for confirmation (optional)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Your name or company"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
            <input
              type="email"
              placeholder="Email for confirmation"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
        </div>
      )}

      {/* Batch progress bar */}
      {batchProgress && (
        <div className="space-y-1.5">
          <p className="text-sm text-gray-600">
            Uploading{" "}
            {Math.min(batchProgress.current * BATCH_SIZE, batchProgress.filesTotal)} of{" "}
            {batchProgress.filesTotal} files
            <span className="text-gray-400">
              {" "}· batch {batchProgress.current}/{batchProgress.total}
            </span>
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${Math.round((batchProgress.filesUploaded / batchProgress.filesTotal) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="btn-primary w-full justify-center py-3"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {batchProgress
                ? `Uploading batch ${batchProgress.current}/${batchProgress.total}...`
                : "Uploading..."
              }
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              {files.some((f) => f.status === "pending" && !f.error && f.isZip)
                ? "Upload ZIP Archive"
                : `Submit ${pendingCount} Invoice${pendingCount !== 1 ? "s" : ""}`
              }
            </>
          )}
        </button>
      )}
    </div>
  );
}
