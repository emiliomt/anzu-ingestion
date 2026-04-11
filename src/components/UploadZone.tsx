"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Search, Building2 } from "lucide-react";

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  referenceNo?: string;
  error?: string;
}

interface UploadZoneProps {
  onUploadComplete?: (references: string[]) => void;
  /** Pre-fill email when a signed-in provider submits */
  prefilledEmail?: string;
  /** When true, vendor must select their company before uploading (used for unauthenticated portal) */
  requireVendorSelection?: boolean;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.heic,.tiff,.webp,.zip";
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;

export function UploadZone({ onUploadComplete, prefilledEmail = "", requireVendorSelection = false }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [email, setEmail] = useState(prefilledEmail);
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successRefs, setSuccessRefs] = useState<string[]>([]);

  // Vendor selection state
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorResults, setVendorResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<{ id: string; name: string } | null>(null);
  const [vendorSearching, setVendorSearching] = useState(false);
  const vendorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const mapped: UploadFile[] = arr
      .slice(0, MAX_FILES - files.length)
      .map((f) => ({
        file: f,
        id: Math.random().toString(36).slice(2),
        status: "pending",
        // ZIP files have a separate 50 MB server-side limit — skip client-side 20 MB check for them
        error:
          f.size > MAX_SIZE && !f.type.includes("zip")
            ? "File exceeds 20 MB limit"
            : undefined,
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

  // Debounced vendor search
  const handleVendorInput = useCallback((value: string) => {
    setVendorQuery(value);
    setSelectedVendor(null); // clear selection whenever the user types again

    if (vendorDebounceRef.current) clearTimeout(vendorDebounceRef.current);

    if (value.trim().length < 2) {
      setVendorResults([]);
      return;
    }

    vendorDebounceRef.current = setTimeout(async () => {
      setVendorSearching(true);
      try {
        const res = await fetch(`/api/vendors/search?q=${encodeURIComponent(value)}`);
        const data = await res.json() as { vendors: { id: string; name: string }[] };
        setVendorResults(data.vendors);
      } catch {
        setVendorResults([]);
      } finally {
        setVendorSearching(false);
      }
    }, 300);
  }, []);

  const canSubmit =
    files.some((f) => f.status === "pending" && !f.error) &&
    (!requireVendorSelection || selectedVendor !== null);

  const handleUpload = async () => {
    const validFiles = files.filter((f) => !f.error && f.status === "pending");
    if (validFiles.length === 0) return;

    setIsUploading(true);

    const formData = new FormData();
    if (email) formData.append("email", email);
    // Send structured vendorId when selected; fall back to free-text name otherwise
    if (selectedVendor) {
      formData.append("vendorId", selectedVendor.id);
    } else if (name) {
      formData.append("name", name);
    }
    validFiles.forEach((f) => formData.append("files", f.file));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json() as {
        results: Array<{ referenceNo: string; fileName: string; status: string; error?: string }>;
      };

      const refs: string[] = [];
      setFiles((prev) =>
        prev.map((f) => {
          // Direct filename match (single-file uploads)
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

          // ZIP file: the extracted entries have different names — collect all received refs
          const isZip = f.file.name.toLowerCase().endsWith(".zip");
          if (isZip) {
            const zipReceived = data.results.filter((r) => r.status === "received");
            zipReceived.forEach((r) => refs.push(r.referenceNo));
            return {
              ...f,
              status: zipReceived.length > 0 ? "success" : "error",
              error: zipReceived.length === 0 ? "No valid invoice files found in ZIP" : undefined,
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
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "pending" ? { ...f, status: "error", error: "Upload failed" } : f
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
            setSelectedVendor(null);
            setVendorQuery("");
            setVendorResults([]);
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
          PDF, PNG, JPG, HEIC, TIFF, WebP or ZIP · Max 20 MB per file (200 MB for ZIP) · Up to 10 files
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
            {requireVendorSelection ? "Identify your company" : "Contact info for confirmation (optional)"}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Vendor selector (required) or free-text name (optional) */}
            {requireVendorSelection ? (
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Your company <span className="text-red-500">*</span>
                </label>
                {selectedVendor ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-indigo-300 rounded-lg bg-indigo-50">
                    <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-indigo-800 flex-1 truncate">{selectedVendor.name}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedVendor(null); setVendorQuery(""); setVendorResults([]); }}
                      className="text-indigo-400 hover:text-indigo-600 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search for your company name…"
                        value={vendorQuery}
                        onChange={(e) => handleVendorInput(e.target.value)}
                        className="input pl-9"
                      />
                      {vendorSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    {vendorResults.length > 0 && (
                      <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {vendorResults.map((v) => (
                          <li key={v.id}>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                              onClick={() => { setSelectedVendor(v); setVendorQuery(v.name); setVendorResults([]); }}
                            >
                              {v.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {vendorQuery.length >= 2 && !vendorSearching && vendorResults.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1 pl-1">
                        No matching company found. Contact your buyer to be added to the system.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Your name or company"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            )}

            <input
              type="email"
              placeholder="Email for confirmation"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>

          {requireVendorSelection && !selectedVendor && files.some((f) => f.status === "pending" && !f.error) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Select your company above to enable submission
            </p>
          )}
        </div>
      )}

      {/* Upload button */}
      {files.some((f) => f.status === "pending" && !f.error) && (
        <button
          onClick={handleUpload}
          disabled={isUploading || !canSubmit}
          className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
