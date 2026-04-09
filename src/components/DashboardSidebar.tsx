"use client";

// Anzu Dynamics — Dashboard Sidebar
// Navigation for the /(dashboard) route group:
//   Settings, Automation, VAT Recovery
// + quick-links to other Anzu modules.

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Settings, Zap, Receipt, LayoutDashboard,
  GitMerge, BookOpen, Globe, ShieldCheck, X,
} from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";

const NAV_ITEMS = [
  { href: "/settings",   label: "Settings",        icon: Settings,       exact: false },
  { href: "/automation", label: "Automation",       icon: Zap,            exact: false },
  { href: "/vat",        label: "VAT Recovery",     icon: Receipt,        exact: false },
];

const OTHER_APPS = [
  { href: "/admin",         label: "Invoice Ingestor",  icon: LayoutDashboard },
  { href: "/matcher",       label: "Invoice Matcher",   icon: GitMerge },
  { href: "/preaccounting", label: "Pre-Accounting",    icon: BookOpen },
  { href: "/security",      label: "Security",          icon: ShieldCheck },
  { href: "/portal",        label: "Vendor Portal",     icon: Globe },
];

interface DashboardSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function DashboardSidebar({ mobileOpen, onMobileClose }: DashboardSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  function SidebarContent() {
    return (
      <>
        {/* Logo */}
        <div
          className="h-16 flex items-center px-5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <AnzuLogo size={24} scheme="dark" />
        </div>

        {/* Primary nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
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
                <span className="xl:block hidden">{label}</span>
                <span className="xl:hidden block sr-only">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Other apps */}
        <div
          className="px-3 pb-5 space-y-0.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px" }}
        >
          <p
            className="px-3 py-1.5 text-xs uppercase tracking-widest xl:block hidden"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            Other Apps
          </p>
          {OTHER_APPS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              title={label}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
              style={{ color: "rgba(255,255,255,0.38)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.7)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.38)";
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="xl:block hidden">{label}</span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#111827" }}
      >
        <button
          className="absolute top-4 right-4 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar — icon-only on md, full on xl */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 z-30 flex-col transition-all duration-300 md:w-16 xl:w-60"
        style={{ background: "#111827" }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
