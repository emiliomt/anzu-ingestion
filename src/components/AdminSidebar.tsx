"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FileText, Settings,
  Globe, Menu, X, BrainCircuit, GitMerge, BookOpen, Sparkles,
} from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";

const NAV_ITEMS = [
  { href: "/admin",           label: "Dashboard",  icon: LayoutDashboard, exact: true },
  { href: "/admin/invoices",  label: "Invoices",   icon: FileText,        exact: false },
  { href: "/admin/training",  label: "Training",   icon: BrainCircuit,    exact: false },
  { href: "/admin/fine-tune", label: "Fine-Tune",  icon: Sparkles,        exact: false },
  { href: "/admin/settings",  label: "Settings",   icon: Settings,        exact: false },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Mobile hamburger (fixed, only visible on small screens) ── */}
      <button
        aria-label="Open navigation"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1e1b4b] text-white rounded-lg shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Mobile overlay ────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={`
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 transition-transform duration-200
          fixed lg:static inset-y-0 left-0 z-50
          w-60 bg-[#1e1b4b] text-white flex flex-col flex-shrink-0
        `}
      >
        {/* Logo row */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <AnzuLogo variant="icon" size={32} />
            <span className="font-semibold text-white">Invoice Ingestor</span>
          </Link>
          {/* Close button (mobile only) */}
          <button
            className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg"
            onClick={() => setOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${active
                    ? "bg-white/15 text-white font-medium"
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-1">
          <p className="px-3 py-1 text-xs font-semibold text-indigo-400 uppercase tracking-wider">Other Apps</p>
          <Link
            href="/matcher"
            className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <GitMerge className="w-4 h-4" />
            Invoice Matcher
          </Link>
          <Link
            href="/preaccounting"
            className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Pre-Accounting
          </Link>
          <Link
            href="/portal"
            className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Globe className="w-4 h-4" />
            Provider Portal
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Globe className="w-4 h-4" />
            Landing Page
          </Link>
        </div>
      </aside>
    </>
  );
}
