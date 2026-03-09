"use client";

import { useState } from "react";
import {
  Cpu, Webhook, FileType, Info,
  Copy, Check, Zap, FileText, Image,
} from "lucide-react";

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-500" />
        : <Copy className="w-3.5 h-3.5 text-gray-400" />
      }
    </button>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-start gap-3">
        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Row inside a section ───────────────────────────────────────────────────────
function Row({
  label,
  value,
  mono = false,
  copyable = false,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  badge?: { text: string; color: string };
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 w-40 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`text-xs text-gray-800 truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      {copyable && <CopyButton text={value} />}
    </div>
  );
}

// ── Pipeline step card ─────────────────────────────────────────────────────────
function PipelineStep({
  step,
  icon,
  title,
  subtitle,
  tag,
  tagColor,
  arrow = true,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  arrow?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
        <div className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
          <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
            {step}
          </div>
          <div className="text-indigo-600 flex-shrink-0 mt-0.5">{icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800">{title}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tagColor}`}>
          {tag}
        </span>
      </div>
      {arrow && <div className="text-gray-300 text-sm flex-shrink-0">→</div>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  // Derive base URL from window.location in client
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  const emailWebhook    = `${origin}/api/webhooks/email`;
  const whatsappWebhook = `${origin}/api/webhooks/whatsapp`;
  const uploadEndpoint  = `${origin}/api/upload`;

  return (
    <>
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0 pl-16 lg:pl-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400">Pipeline configuration and integration details</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* ── Extraction Pipeline ── */}
          <Section
            icon={<Cpu className="w-4 h-4" />}
            title="Extraction Pipeline"
            description="How incoming invoices are processed based on file type"
          >
            {/* XML path */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  XML invoices (DIAN / UBL)
                </span>
                <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  No AI cost
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <PipelineStep
                  step={1} icon={<FileText className="w-3 h-3" />}
                  title="XML received" subtitle="text/xml · application/xml"
                  tag="Input" tagColor="bg-blue-50 text-blue-700"
                />
                <PipelineStep
                  step={2} icon={<Zap className="w-3 h-3" />}
                  title="parseInvoiceXML()" subtitle="CDATA unwrap · NIT parse · UBL fields"
                  tag="Deterministic" tagColor="bg-green-50 text-green-700"
                  arrow={false}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Images &amp; PDFs
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                  Two-pass AI
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <PipelineStep
                  step={1} icon={<Image className="w-3 h-3" />}
                  title="GPT-4o Vision" subtitle="OCR — raw text extraction"
                  tag="gpt-4o" tagColor="bg-indigo-50 text-indigo-700"
                />
                <PipelineStep
                  step={2} icon={<Zap className="w-3 h-3" />}
                  title="OCR Cleaner" subtitle="8-step: fix chars · dates · numbers · markers"
                  tag="Deterministic" tagColor="bg-green-50 text-green-700"
                />
                <PipelineStep
                  step={3} icon={<Cpu className="w-3 h-3" />}
                  title="GPT-4o-mini" subtitle="Structured extraction · 25s timeout"
                  tag="gpt-4o-mini" tagColor="bg-purple-50 text-purple-700"
                  arrow={false}
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-600 mb-1">OCR Model</div>
                <div className="font-mono text-gray-800">gpt-4o</div>
                <div className="text-gray-400 mt-0.5">Vision, 2 048 tokens max</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-600 mb-1">Extraction Model</div>
                <div className="font-mono text-gray-800">gpt-4o-mini</div>
                <div className="text-gray-400 mt-0.5">Text, 1 500 tokens, 25s timeout</div>
              </div>
            </div>
          </Section>

          {/* ── Webhooks & Endpoints ── */}
          <Section
            icon={<Webhook className="w-4 h-4" />}
            title="Webhooks &amp; Endpoints"
            description="Integration URLs for external systems and intake channels"
          >
            <Row label="Web Upload"      value={uploadEndpoint}  mono copyable />
            <Row label="Email Webhook"   value={emailWebhook}    mono copyable
              badge={{ text: "SendGrid Inbound Parse", color: "bg-orange-50 text-orange-700" }}
            />
            <Row label="WhatsApp Webhook" value={whatsappWebhook} mono copyable
              badge={{ text: "Twilio", color: "bg-green-50 text-green-700" }}
            />
            <Row label="Status Lookup"   value={`${origin}/status/{referenceNo}`} mono copyable />
            <Row label="Invoice API"     value={`${origin}/api/invoices`} mono copyable />
            <Row label="Export CSV"      value={`${origin}/api/export`}   mono copyable />
          </Section>

          {/* ── Accepted File Types ── */}
          <Section
            icon={<FileType className="w-4 h-4" />}
            title="Accepted File Types"
            description="MIME types accepted by the upload endpoint"
          >
            <div className="flex flex-wrap gap-2">
              {[
                { label: "PDF",              mime: "application/pdf",   color: "bg-red-50 text-red-700" },
                { label: "JPEG",             mime: "image/jpeg",        color: "bg-sky-50 text-sky-700" },
                { label: "PNG",              mime: "image/png",         color: "bg-sky-50 text-sky-700" },
                { label: "WebP",             mime: "image/webp",        color: "bg-sky-50 text-sky-700" },
                { label: "HEIC",             mime: "image/heic",        color: "bg-sky-50 text-sky-700" },
                { label: "TIFF",             mime: "image/tiff",        color: "bg-sky-50 text-sky-700" },
                { label: "XML (UBL/DIAN)",   mime: "text/xml",          color: "bg-green-50 text-green-700" },
                { label: "XML (application)",mime: "application/xml",   color: "bg-green-50 text-green-700" },
              ].map(({ label, mime, color }) => (
                <div key={mime} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${color}`}>
                  <div>{label}</div>
                  <div className="font-mono opacity-60 text-[10px] mt-0.5">{mime}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── About ── */}
          <Section
            icon={<Info className="w-4 h-4" />}
            title="About"
            description="Application identifiers and format conventions"
          >
            <Row label="App name"           value="AnzuIngestion" />
            <Row label="Reference format"   value="AZ-YYYY-XXXXXX" mono />
            <Row label="Default currency"   value="COP (inferred from document context)" />
            <Row label="Date format stored" value="YYYY-MM-DD (ISO 8601)" mono />
            <Row label="Storage"            value="Local filesystem · ./uploads/ (switchable to S3)" />
            <Row label="Database"           value="PostgreSQL (Railway) · SQLite (local dev)" />
            <Row label="Intake channels"    value="Web · Email (SendGrid) · WhatsApp (Twilio)" />
          </Section>

        </div>
      </div>
    </>
  );
}
