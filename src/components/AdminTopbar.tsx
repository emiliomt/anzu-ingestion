"use client";

import Link from "next/link";
import { Menu, Upload, Zap, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

interface AdminTopbarProps {
  onMenuClick: () => void;
  pageTitle?: string;
}

export function AdminTopbar({ onMenuClick, pageTitle = "Dashboard" }: AdminTopbarProps) {
  const { data: session } = useSession();

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

        {/* User avatar + sign-out */}
        {session?.user && (
          <div className="flex items-center gap-2 ml-1">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "User"}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-gray-100"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold">
                {(session.user.name ?? session.user.email ?? "U")[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
