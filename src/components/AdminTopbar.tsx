"use client";

import Link from "next/link";
import { Menu, Upload, Zap, LogOut } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";

interface AdminTopbarProps {
  onMenuClick: () => void;
  pageTitle?: string;
}

export function AdminTopbar({ onMenuClick, pageTitle = "Dashboard" }: AdminTopbarProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <header
      className="h-16 flex items-center px-4 sm:px-6 gap-4 flex-shrink-0"
      style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}
    >
      {/* Mobile hamburger */}
      <button
        className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 truncate">{pageTitle}</h1>
        <p className="text-xs text-gray-400">Invoice Ingestor · Anzu Dynamics</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Link
          href="/portal"
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors text-gray-600 hover:bg-gray-50"
          style={{ borderColor: "#E2E8F0" }}
        >
          <Upload className="w-4 h-4" />
          Upload Invoice
        </Link>
        <Link
          href="/portal"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
          }}
        >
          <Zap className="w-3.5 h-3.5" />
          Process with AI
        </Link>
        {/* User + logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <span className="hidden md:block text-xs text-gray-500 max-w-[140px] truncate">
              {user.primaryEmailAddress?.emailAddress}
            </span>
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              title="Sign out"
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
