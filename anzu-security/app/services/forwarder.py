"""
Forwarder service.

After a security check passes, POST the original invoice payload (plus the
security check result) to the downstream anzu-matcher service.

The target URL is resolved in order:
  1. config.forward_url  (per-org BuyerConfig override)
  2. MATCHER_URL env var  (global default)

Authentication uses a Bearer token (config.forward_api_key or MATCHER_API_KEY).
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import get_settings
from app.database import BuyerConfig
from app.models.invoice import InvoicePayload, SecurityCheckResponse

logger = logging.getLogger(__name__)
settings = get_settings()

_FORWARD_TIMEOUT = 30  # seconds


def _resolve_forward_url(config: Optional[BuyerConfig]) -> Optional[str]:
    if config and config.forward_url:
        return config.forward_url
    return settings.matcher_url or None


def _resolve_api_key(config: Optional[BuyerConfig]) -> Optional[str]:
    if config and config.forward_api_key:
        return config.forward_api_key
    return settings.matcher_api_key or None


async def forward_to_matcher(
    payload: InvoicePayload,
    check_result: SecurityCheckResponse,
    config: Optional[BuyerConfig],
) -> bool:
    """
    POST the invoice + security result to anzu-matcher.
    Returns True on success (2xx), False otherwise.
    """
    url = _resolve_forward_url(config)
    if not url:
        logger.debug(
            "[Forwarder] No matcher URL configured; skipping forward for invoice %s",
            payload.invoice_id,
        )
        return False

    api_key = _resolve_api_key(config)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    body = {
        "invoice": payload.model_dump(),
        "security": check_result.model_dump(),
    }

    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            resp = await client.post(url, json=body, headers=headers)
        if resp.is_success:
            logger.info(
                "[Forwarder] Invoice %s forwarded to matcher (%s → %d)",
                payload.invoice_id, url, resp.status_code,
            )
            return True
        else:
            logger.error(
                "[Forwarder] Matcher returned %d for invoice %s: %s",
                resp.status_code, payload.invoice_id, resp.text[:200],
            )
            return False
    except Exception as exc:
        logger.error(
            "[Forwarder] Failed to forward invoice %s to %s: %s",
            payload.invoice_id, url, exc,
        )
        return False
