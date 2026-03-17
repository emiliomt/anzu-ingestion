"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FileText, Settings,
  Globe, Menu, X, BrainCircuit, GitMerge, BookOpen, Sparkles,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";

const NAV_ITEMS = [
  { href: "/admin",           label: "Dashboard",  icon: LayoutDashboard, exact: true },
  { href: "/admin/invoices",  label: "Invoices",   icon: FileText,        exact: false },
  { href: "/admin/training",  label: "Training",   icon: BrainCircuit,    exact: false },
  { href: "/admin/fine-tune", label: "Fine-Tune",  icon: Sparkles,        exact: false },
  { href: "/admin/settings",  label: "Settings",   icon: Settings,        exact: false },
];

const OTHER_APPS = [
  { href: "/matcher",      label: "Invoice Matcher",  icon: GitMerge },
  { href: "/preaccounting",label: "Pre-Accounting",   icon: BookOpen },
  { href: "/portal",       label: "Provider Portal",  icon: Globe },
  { href: "/",             label: "Landing Page",     icon: Globe },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group ${
      active ? "text-white" : "text-gray-400 hover:text-white hover:bg-white/10"
    }`;

  return (
    <>
      {/* ── Mobile hamburger ────────────────────────────────────────── */}
      <button
        aria-label="Open navigation"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 text-white rounded-lg shadow-lg"
        style={{ background: "#0C1B3A" }}
        onClick={() => setOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Mobile overlay ──────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden anzu-drawer-backdrop"
          style={{ background: "rgba(12,27,58,0.65)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 transition-all duration-300
          fixed lg:static inset-y-0 left-0 z-50
          ${collapsed ? "lg:w-16" : "lg:w-60"}
          w-60 flex flex-col flex-shrink-0
        `}
        style={{ background: "#0C1B3A" }}
      >
        {/* Logo row */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <AnzuLogo variant="icon" size={30} />
            {!collapsed && (
              <span className="font-semibold text-white text-sm truncate">Invoice Ingestor</span>
            )}
          </Link>
          {/* Mobile close */}
          <button className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg" onClick={() => setOpen(false)}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={navLinkClass(active)}
              >
                {active && (
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.85), rgba(234,88,12,0.85))" }}
                  />
                )}
                <Icon className="w-5 h-5 shrink-0 relative z-10" />
                {!collapsed && (
                  <span className="text-sm relative z-10">{label}</span>
                )}
              </Link>
            );
          })}

          {/* Other apps section */}
          <div className="pt-4 pb-1">
            {!collapsed && (
              <p className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Other Apps
              </p>
            )}
            {collapsed && <div className="border-t border-white/10 mx-2" />}
          </div>

          {OTHER_APPS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, false) && href !== "/";
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={navLinkClass(active)}
              >
                {active && (
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.85), rgba(234,88,12,0.85))" }}
                  />
                )}
                <Icon className="w-5 h-5 shrink-0 relative z-10" />
                {!collapsed && (
                  <span className="text-sm relative z-10">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex px-2 pb-3 border-t border-white/10 pt-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
