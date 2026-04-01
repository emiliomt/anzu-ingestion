"""
Pydantic models for the invoice payload received from anzu-ingestion.

Mirrors the TypeScript ExtractionField interface and the flat DB schema
used by anzu-ingestion's /api/upload endpoint.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class ExtractionField(BaseModel):
    value: Optional[Union[str, float, int]] = None
    confidence: float = 0.0
    is_uncertain: bool = False


class LineItem(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
    category: Optional[str] = None
    confidence: float = 0.0


class InvoicePayload(BaseModel):
    """
    Payload sent by anzu-ingestion after OCR extraction.
    All extracted fields are optional — we only check the ones that are present
    and have a corresponding rule in BuyerConfig.
    """
    invoice_id:   str
    reference_no: str
    channel:      str = "web"   # "web" | "email" | "whatsapp"
    org_id:       str = "default"

    # Core identification
    vendor_name:    Optional[ExtractionField] = None
    vendor_tax_id:  Optional[ExtractionField] = None   # RFC (MX) / NIT (CO) / CUIT (AR)
    vendor_address: Optional[ExtractionField] = None

    # Buyer fields — these are verified against BuyerConfig
    buyer_name:    Optional[ExtractionField] = None
    buyer_tax_id:  Optional[ExtractionField] = None
    buyer_address: Optional[ExtractionField] = None

    # Financial fields (not checked by this service, passed through)
    invoice_number: Optional[ExtractionField] = None
    issue_date:     Optional[ExtractionField] = None
    due_date:       Optional[ExtractionField] = None
    subtotal:       Optional[ExtractionField] = None
    tax:            Optional[ExtractionField] = None
    total:          Optional[ExtractionField] = None
    currency:       Optional[ExtractionField] = None
    po_reference:   Optional[ExtractionField] = None
    payment_terms:  Optional[ExtractionField] = None
    bank_details:   Optional[ExtractionField] = None

    # Extended fields
    concept:          Optional[ExtractionField] = None
    project_name:     Optional[ExtractionField] = None
    project_address:  Optional[ExtractionField] = None
    project_city:     Optional[ExtractionField] = None
    notes:            Optional[ExtractionField] = None

    line_items: List[LineItem] = Field(default_factory=list)

    # Custom fields extracted per org configuration
    custom_fields: Dict[str, ExtractionField] = Field(default_factory=dict)

    # Where anzu-ingestion wants us to POST the result back (optional callback)
    callback_url: Optional[str] = None


# ── Response models ────────────────────────────────────────────────────────────

class FieldCheckResult(BaseModel):
    field: str
    passed: bool
    expected: Optional[str] = None
    actual: Optional[str] = None
    similarity: Optional[float] = None   # 0–100 from rapidfuzz
    reason: Optional[str] = None


class SatCheckResult(BaseModel):
    checked: bool = False                # False if not a MX invoice
    is_blacklisted: bool = False
    rfc: Optional[str] = None
    list_status: Optional[str] = None   # "definitivo" | "presunto" | None
    details: Optional[Dict[str, Any]] = None
    risk_level: Optional[str] = None    # "high" | "medium" | None


class SecurityCheckResponse(BaseModel):
    invoice_id:   str
    reference_no: str
    passed:       bool
    risk_level:   str                   # "low" | "medium" | "high"

    buyer_checks: List[FieldCheckResult] = Field(default_factory=list)
    sat_check:    SatCheckResult = Field(default_factory=SatCheckResult)

    failure_reasons: List[str] = Field(default_factory=list)
    forwarded:       bool = False
    forward_url:     Optional[str] = None

    message: str = ""
