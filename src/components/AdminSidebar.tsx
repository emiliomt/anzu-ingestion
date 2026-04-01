"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FileText, Settings,
  Globe, X, BrainCircuit, Sparkles,
  GitMerge, BookOpen, ExternalLink,
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
  { href: "/matcher",       label: "Invoice Matcher",  icon: GitMerge },
  { href: "/preaccounting", label: "Pre-Accounting",   icon: BookOpen },
  { href: "/portal",        label: "Vendor Portal",    icon: Globe },
];

interface AdminSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  /** "client" hides AI/training-only nav items */
  portalMode?: "admin" | "client";
}

export function AdminSidebar({ mobileOpen, onMobileClose, portalMode = "admin" }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const visibleNavItems = portalMode === "client"
    ? NAV_ITEMS.filter(({ href }) => !href.includes("/training") && !href.includes("/fine-tune"))
    : NAV_ITEMS;

  function SidebarContent() {
    return (
      <>
        {/* Primary nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNavItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
                style={{
                  background: active ? "rgba(249,115,22,0.18)" : "transparent",
                  color: active ? "#FB923C" : "rgba(255,255,255,0.55)",
                  borderLeft: active ? "2px solid #F97316" : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)";
                  }
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Other apps */}
        <div className="px-3 pb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
          <p className="px-3 py-2 text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
            Other Apps
          </p>
          <div className="space-y-0.5">
            {OTHER_APPS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.8)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)";
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Desktop sidebar (always visible on md+) ─────────────────────── */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-full z-30 flex-col transition-all duration-300 md:w-16 xl:w-60"
        style={{ background: "#0C1B3A" }}
      >
        {/* Logo row */}
        <div
          className="h-16 flex items-center px-4 flex-shrink-0 gap-3 overflow-hidden"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Icon-only at md */}
          <div className="xl:hidden">
            <AnzuLogo variant="icon" size={32} />
          </div>
          {/* Full logo + Ingestor at xl */}
          <div className="hidden xl:flex items-center gap-3 min-w-0">
            <AnzuLogo variant="full" scheme="dark" size={32} animate />
            <div
              className="text-xs font-medium shrink-0"
              style={{
                color: "rgba(255,255,255,0.35)",
                borderLeft: "1px solid rgba(255,255,255,0.12)",
                paddingLeft: "10px",
              }}
            >
              Ingestor
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Icon-only at md */}
          <div className="flex-1 flex flex-col min-h-0 xl:hidden px-3 py-4 space-y-0.5 overflow-y-auto">
            {visibleNavItems.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 mx-auto"
                  style={{
                    background: active ? "rgba(249,115,22,0.18)" : "transparent",
                    color: active ? "#FB923C" : "rgba(255,255,255,0.55)",
                  }}
                >
                  <Icon className="w-4 h-4" />
                </Link>
              );
            })}
          </div>
          {/* Full labels at xl */}
          <div className="hidden xl:flex flex-1 flex-col min-h-0">
            <SidebarContent />
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay drawer ────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(12,27,58,0.65)", backdropFilter: "blur(4px)" }}
            onClick={onMobileClose}
          />
          <aside
            className="relative flex flex-col w-72 h-full"
            style={{ background: "#0C1B3A", willChange: "transform" }}
          >
            <div
              className="flex items-center justify-between px-4 h-16 flex-shrink-0 gap-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <AnzuLogo variant="full" scheme="dark" size={32} animate />
                <div
                  className="text-xs font-medium shrink-0"
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    borderLeft: "1px solid rgba(255,255,255,0.12)",
                    paddingLeft: "10px",
                  }}
                >
                  Ingestor
                </div>
              </div>
              <button
                onClick={onMobileClose}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
