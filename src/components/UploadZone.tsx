"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  referenceNo?: string;
  error?: string;
}

function extractUploadErrorMessage(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "results" in payload &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    const firstError = (payload as { results: Array<{ status?: string; error?: string }> }).results.find(
      (r) => r.status === "error" && typeof r.error === "string" && r.error.trim().length > 0
    );
    if (firstError?.error) return firstError.error;
  }

  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  return "Upload failed";
}

interface UploadZoneProps {
  onUploadComplete?: (references: string[]) => void;
  /** Pre-fill email when a signed-in provider submits */
  prefilledEmail?: string;
  /** Org ID embedded in the portal URL — tags vendor uploads to the correct tenant */
  organizationId?: string;
}

const ACCEPTED = ".pdf,.zip,.png,.jpg,.jpeg,.heic,.tiff,.webp";
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 250;

export function UploadZone({ onUploadComplete, prefilledEmail = "", organizationId }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [email, setEmail] = useState(prefilledEmail);
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successRefs, setSuccessRefs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const mapped: UploadFile[] = arr
      .slice(0, MAX_FILES - files.length)
      .map((f) => ({
        file: f,
        id: Math.random().toString(36).slice(2),
        status: "pending",
        error:
          f.size > MAX_SIZE ? "File exceeds 20 MB limit" : undefined,
      }));
    setFiles((prev) => [...prev, ...mapped]);
  }, [files.length]);

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

  const handleUpload = async () => {
    const validFiles = files.filter((f) => !f.error && f.status === "pending");
    if (validFiles.length === 0) return;

    setIsUploading(true);

    const formData = new FormData();
    if (email) formData.append("email", email);
    if (name) formData.append("name", name);
    if (organizationId) formData.append("organizationId", organizationId);
    validFiles.forEach((f) => formData.append("files", f.file));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const raw = await res.json() as unknown;
      const data = raw as {
        results: Array<{ referenceNo: string; fileName: string; status: string; error?: string }>;
      };

      if (!res.ok) {
        throw new Error(extractUploadErrorMessage(raw));
      }

      if (!Array.isArray(data.results)) {
        throw new Error(extractUploadErrorMessage(raw));
      }

      const refs: string[] = [];
      setFiles((prev) =>
        prev.map((f) => {
          const result = data.results.find((r) => r.fileName === f.file.name);
          if (result) {
            if (result.status === "received") refs.push(result.referenceNo);
            return {
              ...f,
              status: result.status === "received" ? "success" : "error",
              referenceNo: result.referenceNo,
              error: result.error,
            };
          }
          return f;
        })
      );

      setSuccessRefs(refs);
      setSubmitted(true);
      onUploadComplete?.(refs);
    } catch (err) {
      console.error(err);
      const fallbackMessage = err instanceof Error && err.message ? err.message : "Upload failed";
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "pending" ? { ...f, status: "error", error: fallbackMessage } : f
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (submitted && successRefs.length > 0) {
    return (
      <div className="card p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Invoice Received!</h3>
        <p className="text-gray-500">
          Your invoice has been received and is being processed.
          {email && " A confirmation email is on its way."}
        </p>
        <div className="bg-indigo-50 rounded-lg p-4">
          {successRefs.map((ref) => (
            <div key={ref} className="mb-2 last:mb-0">
              <p className="text-xs text-indigo-500 uppercase tracking-wider">Reference Number</p>
              <p className="text-2xl font-bold text-indigo-700 tracking-wider">{ref}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {successRefs.map((ref) => (
            <a key={ref} href={`/status/${ref}`} className="btn-secondary text-sm justify-center">
              Track Status →
            </a>
          ))}
        </div>
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
          Submit another invoice
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
          PDF, ZIP, PNG, JPG, JPEG, HEIC, TIFF · Max 20 MB per file · Up to 250 files
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100"
            >
              <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{f.file.name}</p>
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
              {f.status === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
              {f.status === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
              {f.status === "uploading" && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
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

      {/* Upload button */}
      {files.some((f) => f.status === "pending" && !f.error) && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="btn-primary w-full justify-center py-3"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Submit {files.filter((f) => f.status === "pending" && !f.error).length} Invoice
              {files.filter((f) => f.status === "pending" && !f.error).length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}
