"""
Settings router — lets operators configure buyer verification rules per org.

Endpoints:
  GET  /api/v1/settings/{org_id}   — read current config
  PUT  /api/v1/settings/{org_id}   — create or update config
  DELETE /api/v1/settings/{org_id} — remove config (resets to no-check)
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import BuyerConfig, get_db

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])
settings = get_settings()


# ── Request / Response models ──────────────────────────────────────────────────

class BuyerConfigRequest(BaseModel):
    expected_buyer_name:    Optional[str] = Field(
        None, description="Expected buyer legal name (fuzzy-matched)"
    )
    expected_buyer_tax_id:  Optional[str] = Field(
        None, description="Expected buyer tax ID / NIT / RFC (exact match)"
    )
    expected_buyer_address: Optional[str] = Field(
        None, description="Expected buyer address (fuzzy-matched)"
    )
    name_match_threshold:    Optional[float] = Field(
        None, ge=50.0, le=100.0,
        description="Fuzzy name match threshold (50–100). Default: 85"
    )
    address_match_threshold: Optional[float] = Field(
        None, ge=50.0, le=100.0,
        description="Fuzzy address match threshold (50–100). Default: 80"
    )
    forward_url:     Optional[str] = Field(
        None, description="Downstream matcher URL for approved invoices"
    )
    forward_api_key: Optional[str] = Field(
        None, description="Bearer token for the matcher endpoint"
    )


class BuyerConfigResponse(BaseModel):
    org_id:                 str
    expected_buyer_name:    Optional[str]
    expected_buyer_tax_id:  Optional[str]
    expected_buyer_address: Optional[str]
    name_match_threshold:    Optional[float]
    address_match_threshold: Optional[float]
    forward_url:     Optional[str]
    # Never return the api key in full — mask it
    forward_api_key_set: bool
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


def _to_response(cfg: BuyerConfig) -> BuyerConfigResponse:
    return BuyerConfigResponse(
        org_id=cfg.org_id,
        expected_buyer_name=cfg.expected_buyer_name,
        expected_buyer_tax_id=cfg.expected_buyer_tax_id,
        expected_buyer_address=cfg.expected_buyer_address,
        name_match_threshold=cfg.name_match_threshold,
        address_match_threshold=cfg.address_match_threshold,
        forward_url=cfg.forward_url,
        forward_api_key_set=bool(cfg.forward_api_key),
        updated_at=cfg.updated_at,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/{org_id}", response_model=BuyerConfigResponse)
def get_config(org_id: str, db: Session = Depends(get_db)):
    cfg = db.query(BuyerConfig).filter(BuyerConfig.org_id == org_id).first()
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No configuration found for org '{org_id}'",
        )
    return _to_response(cfg)


@router.put("/{org_id}", response_model=BuyerConfigResponse)
def upsert_config(
    org_id: str,
    body: BuyerConfigRequest,
    db: Session = Depends(get_db),
):
    cfg = db.query(BuyerConfig).filter(BuyerConfig.org_id == org_id).first()
    if not cfg:
        cfg = BuyerConfig(org_id=org_id)
        db.add(cfg)

    # Only update fields that were explicitly provided (non-None in request)
    if body.expected_buyer_name    is not None:
        cfg.expected_buyer_name    = body.expected_buyer_name    or None
    if body.expected_buyer_tax_id  is not None:
        cfg.expected_buyer_tax_id  = body.expected_buyer_tax_id  or None
    if body.expected_buyer_address is not None:
        cfg.expected_buyer_address = body.expected_buyer_address or None
    if body.name_match_threshold    is not None:
        cfg.name_match_threshold    = body.name_match_threshold
    if body.address_match_threshold is not None:
        cfg.address_match_threshold = body.address_match_threshold
    if body.forward_url     is not None:
        cfg.forward_url     = body.forward_url     or None
    if body.forward_api_key is not None:
        cfg.forward_api_key = body.forward_api_key or None

    cfg.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cfg)
    return _to_response(cfg)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_config(org_id: str, db: Session = Depends(get_db)):
    cfg = db.query(BuyerConfig).filter(BuyerConfig.org_id == org_id).first()
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No configuration found for org '{org_id}'",
        )
    db.delete(cfg)
    db.commit()
