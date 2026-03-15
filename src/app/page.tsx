import Link from "next/link";
import { LayoutDashboard, GitMerge, FileText, ArrowRight, Upload, BookOpen } from "lucide-react";

export default function HubPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">AZ</span>
          </div>
          <span className="font-semibold text-white text-lg tracking-tight">Anzu</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Title */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-4">
            Invoice Platform
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 leading-tight">
            Where do you want to go?
          </h1>
          <p className="text-gray-400 text-lg">
            Choose an app to get started.
          </p>
        </div>

        {/* App cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
          {/* Ingestor */}
          <Link
            href="/admin"
            className="group flex flex-col p-7 rounded-2xl border border-white/10 bg-white/5 hover:bg-indigo-950/60 hover:border-indigo-500/40 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Invoice Ingestor</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Review, extract and manage invoices submitted via web, email, or WhatsApp.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-800">
                Admin
              </span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-800">
                AI Extraction
              </span>
            </div>
          </Link>

          {/* Matcher */}
          <Link
            href="/matcher"
            className="group flex flex-col p-7 rounded-2xl border border-white/10 bg-white/5 hover:bg-emerald-950/60 hover:border-emerald-500/40 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                <GitMerge className="w-6 h-6 text-white" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Invoice Matcher</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Match processed invoices to Projects, Purchase Orders, or Caja Chica using AI.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-800">
                Admin
              </span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-800">
                AI Matching
              </span>
            </div>
          </Link>

          {/* Pre-Accounting */}
          <Link
            href="/preaccounting"
            className="group flex flex-col p-7 rounded-2xl border border-white/10 bg-white/5 hover:bg-orange-950/60 hover:border-orange-500/40 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Pre-Accounting</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Preliminary P&amp;L and expense classification for approved &amp; matched invoices.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs rounded-full bg-orange-900/60 text-orange-300 border border-orange-800">
                Finance
              </span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-orange-900/60 text-orange-300 border border-orange-800">
                P&amp;L Report
              </span>
            </div>
          </Link>
        </div>

        {/* Vendor link */}
        <div className="mt-10 flex items-center gap-6 text-sm text-gray-600">
          <Link
            href="/portal"
            className="flex items-center gap-2 hover:text-gray-300 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Submit an invoice as a vendor
          </Link>
          <span>·</span>
          <Link
            href="/portal"
            className="flex items-center gap-2 hover:text-gray-300 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Track invoice status
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="pb-6 text-center text-xs text-gray-700">
        AnzuIngestion Platform
      </footer>
    </div>
  );
}
