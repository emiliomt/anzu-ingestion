"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, TableProperties, BarChart2, Menu, X, Globe, GitMerge,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/preaccounting",         label: "P&L Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/preaccounting/charts",  label: "Charts",        icon: BarChart2,       exact: false },
  { href: "/preaccounting/entries", label: "Entries",       icon: TableProperties, exact: false },
];

export function PreaccountingSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Open navigation"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-orange-900 text-white rounded-lg shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 transition-transform duration-200
          fixed lg:static inset-y-0 left-0 z-50
          w-60 bg-orange-950 text-white flex flex-col flex-shrink-0
        `}
      >
        {/* Logo row */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-sm">AZ</span>
            </div>
            <span className="font-semibold text-white">Anzu Accounts</span>
          </div>
          <button
            className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg"
            onClick={() => setOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${active
                    ? "bg-white/15 text-white font-medium"
                    : "text-orange-200 hover:text-white hover:bg-white/10"
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom links */}
        <div className="px-3 pb-4 space-y-2">
          <Link
            href="/matcher"
            className="flex items-center gap-2 px-3 py-2 text-sm text-orange-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <GitMerge className="w-4 h-4" />
            Matcher App
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-orange-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Globe className="w-4 h-4" />
            Home
          </Link>
        </div>
      </aside>
    </>
  );
}
