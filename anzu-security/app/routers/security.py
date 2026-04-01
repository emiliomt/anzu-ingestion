"""
Security check router.

POST /api/v1/check
  Body: InvoicePayload
  Response: SecurityCheckResponse

Flow:
  1. Load BuyerConfig for payload.org_id
  2. Run buyer field checks (name, tax_id, address)
  3. If vendor_tax_id looks like a Mexican RFC → run SAT 69-B check
  4. Aggregate pass/fail and risk level
  5. Persist audit record to security_checks table
  6. If passed → forward to anzu-matcher (async, non-blocking on failure)
  7. Return SecurityCheckResponse

GET /api/v1/check/{invoice_id}
  Returns the most recent security check audit record for an invoice.

POST /api/v1/sat/refresh
  Trigger a manual SAT list refresh (admin operation).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import BuyerConfig, SecurityCheck, get_db
from app.models.invoice import (
    FieldCheckResult, InvoicePayload, SatCheckResult, SecurityCheckResponse
)
from app.services.buyer_checker import check_buyer_fields
from app.services.sat_blacklist import (
    is_mexican_rfc, is_vendor_in_blacklist, refresh_sat_list
)
from app.services.forwarder import forward_to_matcher

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1", tags=["security"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _compute_risk(
    buyer_checks: list[FieldCheckResult],
    sat: SatCheckResult,
    passed: bool,
) -> str:
    if sat.risk_level == "high":
        return "high"
    if not passed:
        return "medium"
    if sat.risk_level == "medium":
        return "medium"
    return "low"


def _persist_check(
    db: Session,
    payload: InvoicePayload,
    result: SecurityCheckResponse,
) -> None:
    record = SecurityCheck(
        invoice_id=payload.invoice_id,
        reference_no=payload.reference_no,
        org_id=payload.org_id,
        passed=result.passed,
        buyer_name_ok=next(
            (c.passed for c in result.buyer_checks if c.field == "buyer_name"), None
        ),
        buyer_tax_id_ok=next(
            (c.passed for c in result.buyer_checks if c.field == "buyer_tax_id"), None
        ),
        buyer_address_ok=next(
            (c.passed for c in result.buyer_checks if c.field == "buyer_address"), None
        ),
        vendor_blacklisted=result.sat_check.is_blacklisted if result.sat_check.checked else None,
        failure_reasons=json.dumps(result.failure_reasons),
        risk_level=result.risk_level,
        forwarded=result.forwarded,
        forward_url=result.forward_url,
        checked_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/check", response_model=SecurityCheckResponse, status_code=status.HTTP_200_OK)
async def run_security_check(
    payload: InvoicePayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Run all security checks on an extracted invoice and optionally forward
    it to the downstream matcher on pass.
    """
    config: Optional[BuyerConfig] = (
        db.query(BuyerConfig)
          .filter(BuyerConfig.org_id == payload.org_id)
          .first()
    )

    failure_reasons: list[str] = []

    # ── 1. Buyer field checks ──────────────────────────────────────────────────
    buyer_checks = check_buyer_fields(payload, config)
    for chk in buyer_checks:
        if not chk.passed and chk.reason:
            failure_reasons.append(chk.reason)

    # ── 2. SAT 69-B blacklist check (Mexican invoices only) ───────────────────
    sat_result = SatCheckResult()
    vendor_tax_id_raw = (
        str(payload.vendor_tax_id.value).strip()
        if payload.vendor_tax_id and payload.vendor_tax_id.value
        else None
    )

    if vendor_tax_id_raw and is_mexican_rfc(vendor_tax_id_raw):
        sat_result.checked = True
        sat_result.rfc = vendor_tax_id_raw.upper().replace(" ", "")

        vendor_name_raw = (
            str(payload.vendor_name.value).strip()
            if payload.vendor_name and payload.vendor_name.value
            else None
        )
        bl = is_vendor_in_blacklist(vendor_tax_id_raw, vendor_name_raw)

        sat_result.is_blacklisted = bl["is_in_list"]
        sat_result.list_status    = bl["status"]
        sat_result.details        = bl["details"]
        sat_result.risk_level     = bl["risk_level"]

        if sat_result.is_blacklisted:
            status_label = sat_result.list_status or "unknown"
            failure_reasons.append(
                f"Vendor RFC {sat_result.rfc} is on the SAT Art.69-B "
                f"EFOS blacklist (status: {status_label})"
            )

    # ── 3. Overall pass/fail ───────────────────────────────────────────────────
    buyer_passed = all(c.passed for c in buyer_checks) if buyer_checks else True
    sat_passed   = not sat_result.is_blacklisted
    passed       = buyer_passed and sat_passed

    risk_level = _compute_risk(buyer_checks, sat_result, passed)

    message = "All checks passed." if passed else f"{len(failure_reasons)} check(s) failed."

    result = SecurityCheckResponse(
        invoice_id=payload.invoice_id,
        reference_no=payload.reference_no,
        passed=passed,
        risk_level=risk_level,
        buyer_checks=buyer_checks,
        sat_check=sat_result,
        failure_reasons=failure_reasons,
        message=message,
    )

    # ── 4. Persist audit record ────────────────────────────────────────────────
    _persist_check(db, payload, result)

    # ── 5. Forward to matcher if passed ───────────────────────────────────────
    if passed:
        forwarded = await forward_to_matcher(payload, result, config)
        result.forwarded   = forwarded
        result.forward_url = (
            (config.forward_url if config and config.forward_url else None)
            or settings.matcher_url
            or None
        )
        if forwarded:
            # Update the audit record with forward info
            record = (
                db.query(SecurityCheck)
                  .filter(SecurityCheck.invoice_id == payload.invoice_id)
                  .order_by(SecurityCheck.checked_at.desc())
                  .first()
            )
            if record:
                record.forwarded   = True
                record.forward_url = result.forward_url
                db.commit()

    return result


@router.get("/check/{invoice_id}", response_model=SecurityCheckResponse)
def get_check_result(invoice_id: str, db: Session = Depends(get_db)):
    """Return the most recent security check result for an invoice ID."""
    record = (
        db.query(SecurityCheck)
          .filter(SecurityCheck.invoice_id == invoice_id)
          .order_by(SecurityCheck.checked_at.desc())
          .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No security check found for invoice '{invoice_id}'",
        )

    failure_reasons: list[str] = []
    if record.failure_reasons:
        try:
            failure_reasons = json.loads(record.failure_reasons)
        except Exception:
            failure_reasons = [record.failure_reasons]

    return SecurityCheckResponse(
        invoice_id=record.invoice_id,
        reference_no=record.reference_no or "",
        passed=record.passed,
        risk_level=record.risk_level or "low",
        failure_reasons=failure_reasons,
        forwarded=record.forwarded or False,
        forward_url=record.forward_url,
        message="Retrieved from audit log.",
    )


@router.post("/sat/refresh", status_code=status.HTTP_202_ACCEPTED)
def trigger_sat_refresh(background_tasks: BackgroundTasks):
    """Admin endpoint: trigger a manual refresh of the SAT 69-B blacklist."""
    background_tasks.add_task(refresh_sat_list)
    return {"message": "SAT list refresh scheduled in background."}


@router.get("/sat/status")
def sat_status(db: Session = Depends(get_db)):
    """Return metadata about the currently loaded SAT list."""
    from app.database import SatListMeta
    meta = db.query(SatListMeta).first()
    if not meta:
        return {"loaded": False, "message": "SAT list has not been downloaded yet."}
    return {
        "loaded": True,
        "downloaded_at": meta.downloaded_at,
        "row_count": meta.row_count,
        "source_url": meta.source_url,
    }
