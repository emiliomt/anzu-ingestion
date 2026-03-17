/** Shared types for the /api/fine-tune/* routes and the /admin/fine-tune page. */

export interface FineTuneListItem {
  id: string;
  referenceNo: string;
  vendorName: string | null;
  total: number | null;
  currency: string | null;
  hasOcrText: boolean;
  hasCorrectedData: boolean;
  updatedAt: string;
}

export interface FineTuneListResponse {
  items: FineTuneListItem[];
  counts: { ready: number; pending: number; uploaded: number };
}
