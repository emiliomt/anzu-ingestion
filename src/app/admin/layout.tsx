"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminTopbar } from "@/components/AdminTopbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: "#F8FAFC" }}>
      <AdminSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      {/* ml-0 mobile (overlay sidebar), md:ml-16 tablet (icon-only), xl:ml-60 desktop (full) */}
      <div className="ml-0 md:ml-16 xl:ml-60 flex-1 min-w-0 overflow-hidden flex flex-col transition-all duration-300">
        <AdminTopbar onMenuClick={() => setMobileOpen(true)} />
        {children}
      </div>
    </div>
  );
}
