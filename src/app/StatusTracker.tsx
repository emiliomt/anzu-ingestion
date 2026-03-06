"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

export function StatusTracker() {
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/status/${encodeURIComponent(ref.trim())}`);
      if (!res.ok) {
        setError("Reference not found. Please check and try again.");
        return;
      }
      router.push(`/status/${encodeURIComponent(ref.trim())}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLookup} className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Enter reference number (e.g. AZ-2025-ABC123)"
        value={ref}
        onChange={(e) => setRef(e.target.value.toUpperCase())}
        className="input flex-1 font-mono text-sm"
      />
      <button type="submit" disabled={loading || !ref.trim()} className="btn-primary">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      </button>
      {error && <p className="text-xs text-red-500 mt-1 absolute">{error}</p>}
    </form>
  );
}
