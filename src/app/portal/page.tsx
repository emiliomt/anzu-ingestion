import { UploadZone } from "@/components/UploadZone";
import { StatusTracker } from "@/app/StatusTracker";
import { Globe, Mail, MessageCircle, Shield, Zap, Search } from "lucide-react";
import Link from "next/link";

export default function ProviderPortal() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-white/60 backdrop-blur bg-white/70 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">AZ</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">AnzuIngestion</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/status/lookup" className="btn-secondary text-sm">
              <Search className="w-4 h-4" />
              Track Invoice
            </Link>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              ← Back
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-indigo-700 text-xs font-medium mb-6">
          <Zap className="w-3.5 h-3.5" />
          AI-powered invoice extraction
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          Submit your invoice,<br />
          <span className="text-indigo-600">we handle the rest</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
          Upload via web, email, or WhatsApp. Our AI extracts all the data automatically —
          no manual entry, no delays.
        </p>

        {/* Channels */}
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-12">
          {[
            { icon: <Globe className="w-5 h-5 text-sky-600" />, label: "Web Upload", bg: "bg-sky-50" },
            { icon: <Mail className="w-5 h-5 text-orange-600" />, label: "Email", bg: "bg-orange-50" },
            { icon: <MessageCircle className="w-5 h-5 text-green-600" />, label: "WhatsApp", bg: "bg-green-50" },
          ].map((ch) => (
            <div key={ch.label} className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl ${ch.bg} flex items-center justify-center`}>
                {ch.icon}
              </div>
              <span className="text-xs font-medium text-gray-600">{ch.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Upload card */}
      <section className="max-w-2xl mx-auto px-4 pb-16">
        <div className="card p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload Invoice</h2>
          <p className="text-sm text-gray-500 mb-5">
            Drag and drop your invoice file or click to browse
          </p>
          <UploadZone />
        </div>

        {/* Email & WhatsApp info */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-800">Email Submission</h3>
            </div>
            <p className="text-xs text-gray-500">
              Send your invoice as a PDF or image attachment to:
            </p>
            <code className="block mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded border text-indigo-700">
              invoices@yourdomain.com
            </code>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-gray-800">WhatsApp Submission</h3>
            </div>
            <p className="text-xs text-gray-500">
              Send your invoice image or PDF to our WhatsApp number:
            </p>
            <code className="block mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded border text-indigo-700">
              +1 (415) 523-8886
            </code>
          </div>
        </div>

        {/* Status tracker */}
        <div className="mt-4 card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800">Track your invoice</h3>
          </div>
          <StatusTracker />
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Encrypted storage
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            &lt;2 min processing
          </div>
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            7-year retention
          </div>
        </div>
      </section>
    </div>
  );
}
