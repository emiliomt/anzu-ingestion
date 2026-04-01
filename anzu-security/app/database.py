"""
SQLAlchemy async engine + session factory and table definitions.
Three tables:
  - buyer_config    : per-organisation buyer verification rules
  - sat_blacklist   : cached EFOS Art.69-B list from SAT
  - security_checks : audit log of every check performed
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer, String, Text, create_engine
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},   # SQLite-specific
    echo=settings.debug,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


# ── Buyer configuration ────────────────────────────────────────────────────────

class BuyerConfig(Base):
    __tablename__ = "buyer_config"

    id = Column(Integer, primary_key=True, index=True)
    # Which organisation this config belongs to (use "default" for single-tenant)
    org_id = Column(String(64), unique=True, index=True, default="default")

    expected_buyer_name    = Column(String(512), nullable=True)
    expected_buyer_tax_id  = Column(String(64),  nullable=True)   # exact match
    expected_buyer_address = Column(String(1024), nullable=True)

    # Override global thresholds per organisation if needed
    name_match_threshold    = Column(Float, nullable=True)   # 0–100
    address_match_threshold = Column(Float, nullable=True)   # 0–100

    # Where to forward approved invoices (overrides MATCHER_URL env var)
    forward_url     = Column(String(512), nullable=True)
    forward_api_key = Column(String(256), nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── SAT Art.69-B EFOS blacklist ────────────────────────────────────────────────

class SatBlacklistEntry(Base):
    __tablename__ = "sat_blacklist"

    id           = Column(Integer, primary_key=True, index=True)
    rfc          = Column(String(14), index=True, nullable=True)   # normalised
    company_name = Column(String(512), nullable=True)
    # "definitivo" | "presunto" | "desvirtuado" | "sentencia_favorable"
    list_status  = Column(String(64), nullable=True)
    # Extra columns from the SAT file (stored as raw text for forward-compat)
    extra        = Column(Text, nullable=True)
    # When this row was imported
    imported_at  = Column(DateTime, default=datetime.utcnow)


class SatListMeta(Base):
    """Tracks the last time the SAT list was downloaded."""
    __tablename__ = "sat_list_meta"

    id            = Column(Integer, primary_key=True)
    downloaded_at = Column(DateTime, nullable=True)
    row_count     = Column(Integer, nullable=True)
    source_url    = Column(String(512), nullable=True)


# ── Audit log ──────────────────────────────────────────────────────────────────

class SecurityCheck(Base):
    __tablename__ = "security_checks"

    id           = Column(Integer, primary_key=True, index=True)
    invoice_id   = Column(String(64), index=True)
    reference_no = Column(String(64), nullable=True)
    org_id       = Column(String(64), default="default")

    passed               = Column(Boolean)
    buyer_name_ok        = Column(Boolean, nullable=True)
    buyer_tax_id_ok      = Column(Boolean, nullable=True)
    buyer_address_ok     = Column(Boolean, nullable=True)
    vendor_blacklisted   = Column(Boolean, nullable=True)

    failure_reasons = Column(Text, nullable=True)   # JSON array string
    risk_level      = Column(String(16), nullable=True)  # "low" | "medium" | "high"

    forwarded    = Column(Boolean, default=False)
    forward_url  = Column(String(512), nullable=True)

    checked_at = Column(DateTime, default=datetime.utcnow)


# ── Bootstrap ──────────────────────────────────────────────────────────────────

def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
