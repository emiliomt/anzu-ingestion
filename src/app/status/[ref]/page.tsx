import { notFound } from "next/navigation";
import { CheckCircle, Clock, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface StatusData {
  referenceNo: string;
  status: string;
  channel: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  totalAmount: string | null;
  submittedAt: string;
  processedAt: string | null;
  flags: string[];
  isDuplicate: boolean;
  events: Array<{ type: string; timestamp: string }>;
}

async function getStatus(ref: string): Promise<StatusData | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${appUrl}/api/status/${ref}`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<StatusData>;
  } catch {
    return null;
  }
}

const STATUS_INFO: Record<string, { icon: React.ReactNode; label: string; desc: string; color: string }> = {
  received: {
    icon: <Clock className="w-6 h-6 text-blue-500" />,
    label: "Received",
    desc: "Your invoice has been received and is queued for processing.",
    color: "bg-blue-50 border-blue-100",
  },
  processing: {
    icon: <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />,
    label: "Processing",
    desc: "Our AI is extracting data from your invoice.",
    color: "bg-yellow-50 border-yellow-100",
  },
  extracted: {
    icon: <CheckCircle className="w-6 h-6 text-purple-500" />,
    label: "Data Extracted",
    desc: "Invoice data has been extracted and is pending review.",
    color: "bg-purple-50 border-purple-100",
  },
  reviewed: {
    icon: <CheckCircle className="w-6 h-6 text-indigo-500" />,
    label: "Reviewed",
    desc: "Your invoice has been reviewed by our team.",
    color: "bg-indigo-50 border-indigo-100",
  },
  complete: {
    icon: <CheckCircle className="w-6 h-6 text-green-500" />,
    label: "Complete",
    desc: "Your invoice has been processed successfully.",
    color: "bg-green-50 border-green-100",
  },
  error: {
    icon: <AlertCircle className="w-6 h-6 text-red-500" />,
    label: "Error",
    desc: "There was an issue processing your invoice. Please contact support.",
    color: "bg-red-50 border-red-100",
  },
};

export default async function StatusPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const status = await getStatus(ref);

  if (!status) notFound();

  const statusInfo = STATUS_INFO[status.status] ?? STATUS_INFO.received;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-white/60 backdrop-blur bg-white/70 sticky top-0">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">AZ</span>
            </div>
            <span className="font-semibold text-gray-900">AnzuIngestion</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        {/* Reference header */}
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">Invoice Reference</p>
          <h1 className="text-3xl font-bold font-mono text-indigo-700">{status.referenceNo}</h1>
        </div>

        {/* Status card */}
        <div className={`card border ${statusInfo.color} p-6 text-center`}>
          <div className="flex justify-center mb-3">{statusInfo.icon}</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">{statusInfo.label}</h2>
          <p className="text-gray-500 text-sm">{statusInfo.desc}</p>
        </div>

        {/* Invoice details */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Channel", value: status.channel.toUpperCase() },
              { label: "Submitted", value: format(new Date(status.submittedAt), "MMM d, yyyy HH:mm") },
              ...(status.vendorName ? [{ label: "Vendor", value: status.vendorName }] : []),
              ...(status.invoiceNumber ? [{ label: "Invoice No.", value: status.invoiceNumber }] : []),
              ...(status.totalAmount ? [{ label: "Amount", value: status.totalAmount }] : []),
              ...(status.processedAt
                ? [{ label: "Processed", value: format(new Date(status.processedAt), "MMM d, yyyy HH:mm") }]
                : []),
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                <p className="text-sm font-medium text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>

          {status.isDuplicate && (
            <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              This invoice may be a duplicate of a previously submitted one. Our team will review it.
            </div>
          )}
        </div>

        {/* Timeline */}
        {status.events.length > 0 && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Timeline
            </h3>
            <div className="space-y-3">
              {status.events.map((event, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5" />
                    {i < status.events.length - 1 && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-full bg-gray-100" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 capitalize">
                      {event.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(event.timestamp), "MMM d, yyyy · HH:mm:ss")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Questions? Contact us at{" "}
          <a href="mailto:support@anzuingestion.com" className="text-indigo-500 hover:underline">
            support@anzuingestion.com
          </a>
        </p>
      </main>
    </div>
  );
}
