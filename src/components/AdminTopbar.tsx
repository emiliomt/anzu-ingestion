"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Bell, Plus, HelpCircle, ChevronDown, Menu } from "lucide-react";

export function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3 shrink-0 sticky top-0 z-20">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search invoices, vendors..."
          className="w-full pl-9 pr-12 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono hidden sm:block">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1" />

      {/* New Invoice CTA */}
      <Link
        href="/portal"
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">New Invoice</span>
      </Link>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
        <Bell className="w-5 h-5" />
      </button>

      {/* Help */}
      <button className="hidden sm:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu((v) => !v)}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "#F97316" }}
          >
            AD
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 hidden sm:block" />
        </button>

        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-900">Admin</div>
                <div className="text-xs text-gray-500">admin@anzudynamics.com</div>
              </div>
              <Link
                href="/admin/settings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setShowUserMenu(false)}
              >
                Settings
              </Link>
              <div className="border-t border-gray-100 mt-1">
                <Link
                  href="/"
                  className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  Sign out
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
