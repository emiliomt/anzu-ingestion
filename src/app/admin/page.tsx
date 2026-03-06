"use client";

import { useState, useEffect } from "react";
import { InvoiceTable } from "@/components/InvoiceTable";
import { InvoiceDetail } from "@/components/InvoiceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";
import {
  LayoutDashboard, FileText, Settings, Globe, X, Menu
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close detail panel on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedInvoiceId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 transition-transform duration-200
          fixed lg:static inset-y-0 left-0 z-30
          w-60 bg-[#1e1b4b] text-white flex flex-col
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-sm">AZ</span>
          </div>
          <span className="font-semibold text-white">AnzuIngestion</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active />
          <NavItem icon={<FileText className="w-4 h-4" />} label="Invoices" />
          <NavItem icon={<Settings className="w-4 h-4" />} label="Settings" />
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Globe className="w-4 h-4" />
            Provider Portal
          </Link>
          <div className="px-3 py-2 text-xs text-indigo-300 border border-white/10 rounded-lg">
            <div className="font-medium mb-0.5">Webhooks</div>
            <div className="opacity-70">Email: /api/webhooks/email</div>
            <div className="opacity-70">WA: /api/webhooks/whatsapp</div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 gap-4 flex-shrink-0">
          <button
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Invoice Dashboard</h1>
            <p className="text-xs text-gray-400">Review and manage incoming invoices</p>
          </div>
        </header>

        {/* Metrics */}
        <div className="flex-shrink-0">
          <MetricsPanel />
        </div>

        {/* Content area: table + detail panel */}
        <div className="flex flex-1 overflow-hidden border-t border-gray-100">
          {/* Invoice table */}
          <div
            className={`
              flex flex-col transition-all duration-200
              ${selectedInvoiceId ? "w-1/2 lg:w-[45%]" : "w-full"}
              overflow-hidden
            `}
          >
            <InvoiceTable
              onSelectInvoice={(id) => setSelectedInvoiceId(id)}
              selectedId={selectedInvoiceId ?? undefined}
            />
          </div>

          {/* Detail panel */}
          {selectedInvoiceId && (
            <div className="flex-1 border-l border-gray-100 overflow-hidden flex flex-col">
              <InvoiceDetail
                invoiceId={selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
                onStatusChange={() => {
                  // Table will auto-refresh
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${active
          ? "bg-white/15 text-white font-medium"
          : "text-indigo-200 hover:text-white hover:bg-white/10"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}
