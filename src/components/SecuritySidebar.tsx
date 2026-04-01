"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ShieldCheck, Settings,
  FileText, GitMerge, BookOpen, Globe,
  X, Menu, ExternalLink,
} from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";

const NAV_ITEMS = [
  { href: "/security",          label: "Dashboard",       icon: LayoutDashboard, exact: true  },
  { href: "/security/checks",   label: "Security Checks", icon: ShieldCheck,     exact: false },
  { href: "/security/settings", label: "Settings",        icon: Settings,        exact: false },
];

const OTHER_APPS = [
  { href: "/admin",    label: "Invoice Ingestor", icon: FileText  },
  { href: "/matcher",  label: "Invoice Matcher",  icon: GitMerge  },
  { href: "/preaccounting", label: "Pre-Accounting",   icon: BookOpen  },
  { href: "/portal",   label: "Vendor Portal",    icon: Globe     },
];

// Accent colour for this app
const ACCENT = "#DC2626"; // red-600

interface SecuritySidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SecuritySidebar({ mobileOpen = false, onMobileClose = () => {} }: SecuritySidebarProps) {
  const pathname = usePathname();
  const [mobileOpenLocal, setMobileOpenLocal] = useState(false);

  const isMobileOpen = mobileOpen || mobileOpenLocal;
  const closeMobile = () => { onMobileClose(); setMobileOpenLocal(false); };

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  function SidebarContent() {
    return (
      <>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 relative"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-xl"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}cc, ${ACCENT})` }}
                  />
                )}
                <Icon className="w-4 h-4 flex-shrink-0 relative z-10" />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
          <p className="px-3 py-2 text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
            Other Apps
          </p>
          <div className="space-y-0.5">
            {OTHER_APPS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
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
      {/* Mobile hamburger */}
      <button
        aria-label="Open navigation"
        className="md:hidden fixed top-4 left-4 z-50 p-2 text-white rounded-lg shadow-lg"
        style={{ background: "#0C1B3A" }}
        onClick={() => setMobileOpenLocal(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-full z-30 flex-col transition-all duration-300 md:w-16 xl:w-60"
        style={{ background: "#0C1B3A" }}
      >
        <div
          className="h-16 flex items-center px-4 flex-shrink-0 gap-3 overflow-hidden"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="xl:hidden">
            <AnzuLogo variant="icon" size={32} />
          </div>
          <div className="hidden xl:flex items-center gap-3 min-w-0">
            <AnzuLogo variant="full" scheme="dark" size={32} animate />
            <div
              className="text-xs font-medium shrink-0"
              style={{ color: "rgba(255,255,255,0.35)", borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: "10px" }}
            >
              Security
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Icon-only at md */}
          <div className="flex-1 flex flex-col min-h-0 xl:hidden px-3 py-4 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link key={href} href={href} title={label}
                  className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 mx-auto relative"
                  style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${ACCENT}cc, ${ACCENT})` }}
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
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

      {/* Mobile overlay drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(12,27,58,0.65)", backdropFilter: "blur(4px)" }}
            onClick={closeMobile}
          />
          <aside className="relative flex flex-col w-72 h-full" style={{ background: "#0C1B3A" }}>
            <div
              className="flex items-center justify-between px-4 h-16 flex-shrink-0 gap-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <AnzuLogo variant="full" scheme="dark" size={32} animate />
                <div
                  className="text-xs font-medium shrink-0"
                  style={{ color: "rgba(255,255,255,0.35)", borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: "10px" }}
                >
                  Security
                </div>
              </div>
              <button onClick={closeMobile} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0">
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
