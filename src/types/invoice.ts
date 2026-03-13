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

export type LineItemCategory =
  | "material"
  | "labor"
  | "equipment"
  | "freight"
  | "overhead"
  | "tax"
  | "discount"
  | "other";

export interface LineItemData {
  id: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  category: LineItemCategory | null;
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

// ── Project / PO Matching Module ─────────────────────────────────────────────

export type ProjectStatus = "active" | "closed" | "on_hold";
export type POStatus = "open" | "partially_matched" | "fully_matched" | "closed";
export type CajaChicaStatus = "open" | "closed";
export type MatchType = "project" | "purchase_order" | "caja_chica";

export interface Project {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  budget: number | null;
  currency: string;
  status: ProjectStatus;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { purchaseOrders: number; invoiceMatches: number };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  projectId: string | null;
  projectName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  description: string | null;
  totalAmount: number | null;
  currency: string;
  issueDate: string | null;
  expiryDate: string | null;
  status: POStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { invoiceMatches: number };
}

export interface CajaChica {
  id: string;
  name: string;
  period: string | null;
  balance: number | null;
  currency: string;
  status: CajaChicaStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { invoiceMatches: number };
}

export interface InvoiceMatch {
  id: string;
  invoiceId: string;
  invoiceRef: string | null;
  matchType: MatchType;
  projectId: string | null;
  projectName: string | null;
  purchaseOrderId: string | null;
  poNumber: string | null;
  cajaChicaId: string | null;
  cajaChicaName: string | null;
  confidence: number | null;
  reasoning: string | null;
  matchedBy: string | null;
  matchedAt: string;
  isConfirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface MatchSuggestion {
  invoiceId: string;
  referenceNo: string;
  vendorName: string | null;
  total: string | null;
  poReference: string | null;
  projectName: string | null;
  existingMatch: InvoiceMatch | null;
  suggestion: {
    matchType: MatchType;
    matchId: string;
    matchLabel: string;
    confidence: number;
    reasoning: string;
  } | null;
}
