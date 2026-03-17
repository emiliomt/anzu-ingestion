"use client";

import { X, Sparkles } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div
      className="text-white text-center py-2.5 px-4 flex items-center justify-center gap-3 relative text-xs"
      style={{ background: "linear-gradient(90deg, #1D4ED8 0%, #2563EB 50%, #1D4ED8 100%)" }}
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0" />
      <span>
        New: Native SAP S/4HANA integration now available.{" "}
        <Link href="/demo" className="underline underline-offset-2 hover:opacity-80 font-semibold">
          See demo →
        </Link>
      </span>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Close"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
