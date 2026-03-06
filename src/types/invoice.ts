export type InvoiceChannel = "web" | "email" | "whatsapp";
export type InvoiceStatus =
  | "received"
  | "processing"
  | "extracted"
  | "reviewed"
  | "complete"
  | "error";

export interface InvoiceListItem {
  id: string;
  referenceNo: string;
  channel: InvoiceChannel;
  status: InvoiceStatus;
  fileName: string;
  submittedBy: string | null;
  submittedName: string | null;
  submittedAt: string;
  isDuplicate: boolean;
  flags: string[];
  vendorName: string | null;
  totalAmount: string | null;
}

export interface ExtractedFieldData {
  id: string;
  fieldName: string;
  value: string | null;
  confidence: number | null;
  isVerified: boolean;
  isUncertain: boolean;
}

export interface LineItemData {
  id: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  confidence: number | null;
}

export interface IngestionEventData {
  id: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface InvoiceDetail extends InvoiceListItem {
  fileUrl: string;
  mimeType: string;
  fileSize: number | null;
  processedAt: string | null;
  reviewedBy: string | null;
  duplicateOf: string | null;
  extractedData: ExtractedFieldData[];
  lineItems: LineItemData[];
  events: IngestionEventData[];
}

export interface DashboardMetrics {
  totalToday: number;
  byChannel: { web: number; email: number; whatsapp: number };
  byStatus: Record<InvoiceStatus, number>;
  flagged: number;
  duplicates: number;
  avgConfidence: number | null;
}
