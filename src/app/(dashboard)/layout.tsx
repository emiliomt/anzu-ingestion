"use client";

// Anzu Dynamics — Dashboard Layout (Multi-Tenant Shell)
// Wraps /settings, /automation, and /vat with the DashboardSidebar + AdminTopbar.
// /onboarding is full-page (no chrome) so it passes through unchanged.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { AdminTopbar } from "@/components/AdminTopbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Onboarding is a full-page wizard — render without sidebar/topbar chrome
  if (pathname === "/onboarding") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#F8FAFC" }}>
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      {/* ml-0 mobile, md:ml-16 tablet (icon-only sidebar), xl:ml-60 desktop */}
      <div className="ml-0 md:ml-16 xl:ml-60 flex-1 min-w-0 overflow-hidden flex flex-col transition-all duration-300">
        <AdminTopbar
          onMenuClick={() => setMobileOpen(true)}
          pageTitle={pageTitleFor(pathname)}
        />
        {children}
      </div>
    </div>
  );
}

function pageTitleFor(pathname: string): string {
  if (pathname.startsWith("/settings"))   return "Settings";
  if (pathname.startsWith("/automation")) return "Automation";
  if (pathname.startsWith("/vat"))        return "VAT Recovery";
  return "Dashboard";
}
