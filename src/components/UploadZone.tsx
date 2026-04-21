"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, ChevronDown } from "lucide-react";

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
}

interface PublicOrganization {
  id: string;
  name: string;
  logo: string | null;
}

const ACCEPTED = ".pdf,.zip,.png,.jpg,.jpeg,.heic,.tiff,.webp";
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 250;
const UPLOAD_BATCH_SIZE = 10;
const UPLOAD_MAX_CONCURRENCY = 1;

type UploadApiResult = {
  referenceNo: string;
  fileName: string;
  status: string;
  error?: string;
};

type UploadApiResponse = {
  results?: UploadApiResult[];
  error?: string;
};

async function parseUploadResponse(res: Response): Promise<UploadApiResponse> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: `Empty server response (${res.status})` };
  }

  try {
    return JSON.parse(text) as UploadApiResponse;
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, " ").trim();
    return {
      error: `Server returned non-JSON response (${res.status}): ${preview || "no response body"}`,
    };
  }
}

export function UploadZone({ onUploadComplete, prefilledEmail = "" }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [email, setEmail] = useState(prefilledEmail);
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successRefs, setSuccessRefs] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<PublicOrganization[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadOrganizations() {
      setLoadingOrgs(true);
      setOrgsError(null);
      try {
        const res = await fetch("/api/organizations/public", { cache: "no-store" });
        const data = await res.json() as { organizations?: PublicOrganization[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load companies");
        }
        setOrgs(data.organizations ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load companies";
        setOrgsError(message);
      } finally {
        setLoadingOrgs(false);
      }
    }
    loadOrganizations();
  }, []);

  const filteredOrgs = useMemo(() => {
    const term = orgSearch.trim().toLowerCase();
    if (!term) return orgs;
    return orgs.filter((org) => org.name.toLowerCase().includes(term));
  }, [orgSearch, orgs]);

  const selectedOrg = useMemo(
    () => orgs.find((org) => org.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId]
  );

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
    const ids = new Set(validFiles.map((f) => f.id));
    setFiles((prev) =>
      prev.map((f) =>
        ids.has(f.id)
          ? { ...f, status: "uploading", error: undefined }
          : f
      )
    );

    const refs: string[] = [];

    async function uploadBatch(batch: UploadFile[]) {
      const batchByName = new Map<string, UploadFile[]>();
      for (const fileItem of batch) {
        const arr = batchByName.get(fileItem.file.name) ?? [];
        arr.push(fileItem);
        batchByName.set(fileItem.file.name, arr);
      }

      const formData = new FormData();
      if (email) formData.append("email", email);
      if (name) formData.append("name", name);
      if (selectedOrgId) formData.append("organizationId", selectedOrgId);
      batch.forEach((f) => formData.append("files", f.file));

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const raw = await parseUploadResponse(res);
        const data = raw as { results: UploadApiResult[] };

        if (!res.ok || !Array.isArray(data.results)) {
          throw new Error(extractUploadErrorMessage(raw));
        }

        const resultById = new Map<string, {
          status: "success" | "error";
          referenceNo?: string;
          error?: string;
        }>();

        for (const r of data.results) {
          const matches = batchByName.get(r.fileName);
          const target = matches?.shift();
          if (!target) continue;

          if (r.status === "received") {
            refs.push(r.referenceNo);
            resultById.set(target.id, {
              status: "success",
              referenceNo: r.referenceNo,
            });
          } else {
            resultById.set(target.id, {
              status: "error",
              error: r.error ?? "Upload failed",
            });
          }
        }

        setFiles((prev) =>
          prev.map((f) => {
            const mapped = resultById.get(f.id);
            if (!mapped) return f;
            return {
              ...f,
              status: mapped.status,
              referenceNo: mapped.referenceNo,
              error: mapped.error,
            };
          })
        );
      } catch (err) {
        console.error(err);

        // Automatically split failed batches to reduce payload/timeout failures.
        if (batch.length > 1) {
          const midpoint = Math.ceil(batch.length / 2);
          await uploadBatch(batch.slice(0, midpoint));
          await uploadBatch(batch.slice(midpoint));
          return;
        }

        const fallbackMessage = err instanceof Error && err.message
          ? err.message
          : "Upload failed";
        const failedIds = new Set(batch.map((f) => f.id));
        setFiles((prev) =>
          prev.map((f) =>
            failedIds.has(f.id)
              ? { ...f, status: "error", error: fallbackMessage }
              : f
          )
        );
      }
    }

    for (let i = 0; i < validFiles.length; i += UPLOAD_BATCH_SIZE * UPLOAD_MAX_CONCURRENCY) {
      const group = validFiles.slice(i, i + UPLOAD_BATCH_SIZE * UPLOAD_MAX_CONCURRENCY);
      for (let j = 0; j < group.length; j += UPLOAD_BATCH_SIZE) {
        const batch = group.slice(j, j + UPLOAD_BATCH_SIZE);
        await uploadBatch(batch);
      }
    }

    setSuccessRefs(refs);
    setSubmitted(true);
    onUploadComplete?.(refs);
    setIsUploading(false);
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
            setSelectedOrgId("");
            setOrgSearch("");
          }}
        >
          Submit another invoice
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Company selector */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Step 1: Select receiving company</p>
        <p className="text-xs text-gray-500">
          Choose the company that should receive and process these invoices.
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOrgDropdownOpen((v) => !v)}
            disabled={loadingOrgs}
            className="input w-full flex items-center justify-between disabled:opacity-60"
          >
            <span className={`truncate ${selectedOrg ? "text-gray-800" : "text-gray-400"}`}>
              {selectedOrg ? selectedOrg.name : "Select a client company"}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${orgDropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {orgDropdownOpen && !loadingOrgs && !orgsError && (
            <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg p-2 space-y-2">
              <input
                type="text"
                placeholder="Search company..."
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                className="input"
              />
              <div className="max-h-52 overflow-auto space-y-1">
                {filteredOrgs.length === 0 ? (
                  <div className="text-xs text-gray-400 px-2 py-1">No companies found.</div>
                ) : (
                  filteredOrgs.map((org) => {
                    const selected = selectedOrgId === org.id;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrgId(org.id);
                          setOrgDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                          selected
                            ? "border-indigo-300 bg-indigo-50"
                            : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50"
                        }`}
                      >
                        {org.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={org.logo} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                            {org.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-medium text-gray-700 truncate">{org.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        {loadingOrgs ? (
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading companies...
          </div>
        ) : orgsError ? (
          <div className="text-xs text-red-500">{orgsError}</div>
        ) : orgs.length === 0 ? (
          <div className="text-xs text-gray-400">No client companies are available yet.</div>
        ) : null}
      </div>

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
          disabled={isUploading || !selectedOrgId}
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
