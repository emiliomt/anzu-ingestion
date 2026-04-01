"""
Buyer verification service.

Checks the extracted buyer fields (name, tax ID, address) from an invoice
against the expected values stored in BuyerConfig.

Rules:
  - buyer_tax_id : exact string match (normalised: uppercase, no spaces/hyphens)
  - buyer_name   : fuzzy match via rapidfuzz (WRatio ≥ threshold)
  - buyer_address: fuzzy match via rapidfuzz (token_set_ratio ≥ threshold)

A field is skipped (not counted as a failure) when:
  - The expected value is not configured, OR
  - The extracted value is None / empty
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from rapidfuzz import fuzz

from app.models.invoice import ExtractionField, FieldCheckResult, InvoicePayload
from app.database import BuyerConfig
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _normalise_tax_id(value: str) -> str:
    """Uppercase, remove spaces, hyphens, and dots."""
    return re.sub(r"[\s\-.]", "", value).upper()


def _str_value(field: Optional[ExtractionField]) -> Optional[str]:
    """Extract a plain string from an ExtractionField, or None."""
    if field is None or field.value is None:
        return None
    return str(field.value).strip()


def check_buyer_fields(
    payload: InvoicePayload,
    config: Optional[BuyerConfig],
) -> list[FieldCheckResult]:
    """
    Returns a list of FieldCheckResult, one per configured buyer field.
    An empty list means nothing was configured to check.
    """
    results: list[FieldCheckResult] = []

    if config is None:
        return results

    name_threshold    = config.name_match_threshold    or settings.name_match_threshold
    address_threshold = config.address_match_threshold or settings.address_match_threshold

    # ── buyer_tax_id (exact) ───────────────────────────────────────────────────
    if config.expected_buyer_tax_id:
        expected_raw = config.expected_buyer_tax_id
        expected_norm = _normalise_tax_id(expected_raw)
        actual_raw = _str_value(payload.buyer_tax_id)

        if actual_raw is not None:
            actual_norm = _normalise_tax_id(actual_raw)
            passed = (actual_norm == expected_norm)
            results.append(FieldCheckResult(
                field="buyer_tax_id",
                passed=passed,
                expected=expected_norm,
                actual=actual_norm,
                similarity=100.0 if passed else 0.0,
                reason=None if passed else (
                    f"Tax ID mismatch: got '{actual_norm}', expected '{expected_norm}'"
                ),
            ))
        else:
            # Field not extracted — flag as failure only if we expected it
            results.append(FieldCheckResult(
                field="buyer_tax_id",
                passed=False,
                expected=expected_norm,
                actual=None,
                reason="buyer_tax_id was not extracted from the invoice",
            ))

    # ── buyer_name (fuzzy) ────────────────────────────────────────────────────
    if config.expected_buyer_name:
        expected = config.expected_buyer_name.strip()
        actual = _str_value(payload.buyer_name)

        if actual is not None:
            # WRatio handles abbreviations, extra tokens, etc.
            score = fuzz.WRatio(expected.upper(), actual.upper())
            passed = score >= name_threshold
            results.append(FieldCheckResult(
                field="buyer_name",
                passed=passed,
                expected=expected,
                actual=actual,
                similarity=round(score, 1),
                reason=None if passed else (
                    f"Name similarity {score:.1f}% < threshold {name_threshold:.0f}%"
                ),
            ))
        else:
            results.append(FieldCheckResult(
                field="buyer_name",
                passed=False,
                expected=expected,
                actual=None,
                reason="buyer_name was not extracted from the invoice",
            ))

    # ── buyer_address (fuzzy, token-set) ──────────────────────────────────────
    if config.expected_buyer_address:
        expected = config.expected_buyer_address.strip()
        actual = _str_value(payload.buyer_address)

        if actual is not None:
            # token_set_ratio ignores word order and is robust to partial addresses
            score = fuzz.token_set_ratio(expected.upper(), actual.upper())
            passed = score >= address_threshold
            results.append(FieldCheckResult(
                field="buyer_address",
                passed=passed,
                expected=expected,
                actual=actual,
                similarity=round(score, 1),
                reason=None if passed else (
                    f"Address similarity {score:.1f}% < threshold {address_threshold:.0f}%"
                ),
            ))
        else:
            results.append(FieldCheckResult(
                field="buyer_address",
                passed=False,
                expected=expected,
                actual=None,
                reason="buyer_address was not extracted from the invoice",
            ))

    return results
