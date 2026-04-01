"use client";

/**
 * /provider/* layout — PROVIDER portal
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal layout for the supplier portal. No access to admin/client sections.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Upload, FileText, Link2, Menu, X, LayoutDashboard,
} from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";

const NAV_ITEMS = [
  { href: "/provider",             label: "Upload Invoice",      icon: Upload },
  { href: "/provider/dashboard",   label: "My Invoices",         icon: LayoutDashboard },
  { href: "/provider/connections", label: "Client Connections",  icon: Link2 },
];

function ProviderSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center justify-between px-4 shrink-0 border-b"
        style={{ height: "64px", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <AnzuLogo variant="full" scheme="dark" size={26} />
        <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "rgba(59,130,246,0.2)", color: "#93C5FD" }}
        >
          <FileText className="w-3 h-3" />
          Supplier Portal
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                background: isActive ? "rgba(249,115,22,0.2)" : "transparent",
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User button */}
      <div
        className="px-4 py-4 border-t shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <UserButton afterSignOutUrl="/portal" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-30 shrink-0"
        style={{ background: "#0C1B3A" }}
      >
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={onClose}
          />
          <div className="relative flex flex-col w-72 h-full" style={{ background: "#0C1B3A" }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen flex" style={{ background: "#F8FAFC" }}>
      <ProviderSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="md:ml-60 flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div
          className="flex md:hidden items-center gap-3 px-4 h-14 border-b bg-white border-gray-100"
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <AnzuLogo variant="full" scheme="light" size={22} />
        </div>
        {children}
      </div>
    </div>
  );
}
