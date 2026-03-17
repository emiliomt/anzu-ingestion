"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FileText, Settings,
  Globe, X, BrainCircuit, Sparkles,
  GitMerge, BookOpen,
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
  { href: "/portal",        label: "Provider Portal",  icon: Globe },
];

interface AdminSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group ${
      active ? "text-white" : "text-gray-400 hover:text-white hover:bg-white/10"
    }`;

  function NavContent({ showLabels }: { showLabels: boolean }) {
    return (
      <>
        {/* Company context */}
        {showLabels && (
          <div
            className="mx-3 mt-4 mb-2 px-3 py-2.5 rounded-lg border border-white/10"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "#F97316" }}
              >
                A
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">Anzu Ingestion</div>
                <div className="text-gray-400 text-xs">Pro Plan</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} onClick={onMobileClose} className={linkClass(active)}>
                {active && (
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.85), rgba(234,88,12,0.85))" }}
                  />
                )}
                <Icon className="w-5 h-5 shrink-0 relative z-10" />
                {showLabels && <span className="text-sm relative z-10">{label}</span>}
              </Link>
            );
          })}

          {showLabels ? (
            <div className="pt-4 pb-1">
              <p className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Other Apps</p>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/10 mx-2" />
          )}

          {OTHER_APPS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, false);
            return (
              <Link key={href} href={href} onClick={onMobileClose} className={linkClass(active)}>
                {active && (
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.85), rgba(234,88,12,0.85))" }}
                  />
                )}
                <Icon className="w-5 h-5 shrink-0 relative z-10" />
                {showLabels && <span className="text-sm relative z-10">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User row */}
        <div className="border-t border-white/10 px-2 py-3">
          {showLabels && (
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                style={{ background: "#F97316" }}
              >
                AD
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">Admin</div>
                <div className="text-gray-400 text-xs">admin@anzudynamics.com</div>
              </div>
            </div>
          )}
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
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          <AnzuLogo variant="icon" size={30} className="xl:hidden" />
          <AnzuLogo variant="full" scheme="dark" size={30} animate className="hidden xl:block" />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Icon-only at md (hidden at xl) */}
          <div className="flex-1 flex flex-col min-h-0 xl:hidden">
            <NavContent showLabels={false} />
          </div>
          {/* Full labels at xl */}
          <div className="hidden flex-1 flex-col min-h-0 xl:flex">
            <NavContent showLabels={true} />
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
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 shrink-0">
              <AnzuLogo variant="full" scheme="dark" size={28} animate />
              <button
                onClick={onMobileClose}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <NavContent showLabels={true} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
