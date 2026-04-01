"""
SAT Art.69-B EFOS blacklist service.

Lifecycle:
  1. On app startup, load_sat_list() is called.
     - If the DB already has a fresh list (< SAT_REFRESH_INTERVAL_HOURS), it is
       loaded into the in-memory cache.
     - Otherwise the latest file is downloaded from the SAT portal, processed,
       persisted to SQLite, and cached.
  2. APScheduler triggers refresh_sat_list() every SAT_REFRESH_INTERVAL_HOURS.
  3. is_vendor_in_blacklist() performs O(1) dict lookup by RFC, with an optional
     fuzzy-name fallback.

Integration note:
  - Only invoke this check when vendor_tax_id looks like a Mexican RFC
    (3-4 letters + 6 digits + 3 alphanumeric chars).
  - High-risk result (definitivo) should block IVA recovery auto-claim and
    flag the invoice for manual review.
  - Medium-risk (presunto) should warn but not hard-block.

SAT download page:
  http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/
  contribuyentes_publicados.html
  Look for the Excel/CSV link under Artículo 69-B section.
"""
from __future__ import annotations

import io
import logging
import re
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup
from rapidfuzz import fuzz, process as fuzz_process
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SatBlacklistEntry, SatListMeta, SessionLocal

logger = logging.getLogger(__name__)
settings = get_settings()

# ── In-memory cache ────────────────────────────────────────────────────────────
# rfc_cache   : { normalised_rfc -> row_dict }
# name_cache  : list of (normalised_name, row_dict) for fuzzy fallback
_rfc_cache:  Dict[str, Dict[str, Any]] = {}
_name_cache: list[tuple[str, Dict[str, Any]]] = []
_cache_loaded = False


# ── RFC detection ──────────────────────────────────────────────────────────────

_RFC_RE = re.compile(
    r"^[A-ZÑ&]{3,4}"   # 3 letters (moral) or 4 letters (física)
    r"\d{6}"            # birth/incorporation date YYMMDD
    r"[A-Z0-9]{3}$",    # homoclave
    re.IGNORECASE,
)


def is_mexican_rfc(tax_id: str) -> bool:
    """Return True if tax_id matches the RFC format."""
    normalised = re.sub(r"[\s\-.]", "", tax_id).upper()
    return bool(_RFC_RE.match(normalised))


def _normalise_rfc(rfc: str) -> str:
    return re.sub(r"[\s\-.]", "", rfc).upper()


def _normalise_name(name: str) -> str:
    return re.sub(r"\s+", " ", name).upper().strip()


# ── SAT file download ──────────────────────────────────────────────────────────

_KNOWN_PATTERNS = [
    # Pattern used as of 2024 – update here if SAT changes the filename
    re.compile(r"69[_\-]?B.*definitivo.*\.(xlsx?|csv)", re.IGNORECASE),
    re.compile(r"definitivo.*69[_\-]?B.*\.(xlsx?|csv)", re.IGNORECASE),
    re.compile(r"efos.*definitivo.*\.(xlsx?|csv)", re.IGNORECASE),
    re.compile(r"listado.*definitivo.*\.(xlsx?|csv)", re.IGNORECASE),
]


def _find_download_url(page_url: str) -> Optional[str]:
    """
    Scrape the SAT data page and return the absolute URL of the most recent
    69-B definitive list file (Excel or CSV).
    Falls back to any href that looks like an Excel/CSV on that page.
    """
    try:
        resp = requests.get(page_url, timeout=settings.sat_download_timeout_seconds, verify=False)
        resp.raise_for_status()
    except Exception as exc:
        logger.error("[SAT] Failed to fetch download page: %s", exc)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    base = "http://omawww.sat.gob.mx"

    candidates: list[str] = []
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if not href.endswith((".xls", ".xlsx", ".csv")):
            continue
        full = href if href.startswith("http") else base + href
        candidates.append(full)

    # Try pattern matches first (most specific)
    for pattern in _KNOWN_PATTERNS:
        for url in candidates:
            if pattern.search(url.split("/")[-1]):
                logger.info("[SAT] Found definitive list URL: %s", url)
                return url

    # Fallback: return any Excel/CSV found
    if candidates:
        logger.warning("[SAT] No pattern matched; using first candidate: %s", candidates[0])
        return candidates[0]

    logger.error("[SAT] No download links found on page: %s", page_url)
    return None


def _download_and_parse(url: str) -> Optional[pd.DataFrame]:
    """Download the SAT file and return a normalised DataFrame."""
    logger.info("[SAT] Downloading blacklist from %s", url)
    try:
        resp = requests.get(
            url,
            timeout=settings.sat_download_timeout_seconds,
            verify=False,
            stream=True,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.error("[SAT] Download failed: %s", exc)
        return None

    content = resp.content
    filename = url.split("/")[-1].lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(
                io.BytesIO(content),
                encoding="latin-1",
                dtype=str,
                on_bad_lines="skip",
            )
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as exc:
        logger.error("[SAT] Failed to parse file: %s", exc)
        return None

    # Normalise column names (lowercase, no accents)
    df.columns = [str(c).strip().lower() for c in df.columns]
    logger.info("[SAT] Downloaded %d rows, columns: %s", len(df), list(df.columns))
    return df


def _detect_columns(df: pd.DataFrame) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Auto-detect which columns hold RFC, company name, and status.
    The SAT sometimes changes header names across releases.
    Returns (rfc_col, name_col, status_col).
    """
    rfc_candidates    = ["rfc", "r.f.c", "r.f.c.", "clave rfc"]
    name_candidates   = ["nombre", "denominacion", "razon social", "razon_social",
                          "nombre o denominacion social"]
    status_candidates = ["situacion", "situación", "estatus", "status", "tipo"]

    def first_match(candidates: list[str]) -> Optional[str]:
        for c in candidates:
            if c in df.columns:
                return c
        # Partial match fallback
        for c in candidates:
            for col in df.columns:
                if c in col:
                    return col
        return None

    return (
        first_match(rfc_candidates),
        first_match(name_candidates),
        first_match(status_candidates),
    )


# ── DB persistence ─────────────────────────────────────────────────────────────

def _persist_to_db(df: pd.DataFrame, source_url: str) -> int:
    """Clear old rows and insert fresh data. Returns row count saved."""
    rfc_col, name_col, status_col = _detect_columns(df)

    db: Session = SessionLocal()
    try:
        db.query(SatBlacklistEntry).delete()
        rows_saved = 0

        for _, row in df.iterrows():
            rfc    = _normalise_rfc(str(row[rfc_col]))    if rfc_col    else None
            name   = _normalise_name(str(row[name_col]))  if name_col   else None
            status = str(row[status_col]).strip().lower()  if status_col else None

            # Collect extra columns as JSON
            extra_cols = {c: str(row[c]) for c in df.columns
                          if c not in [rfc_col, name_col, status_col]}
            entry = SatBlacklistEntry(
                rfc=rfc,
                company_name=name,
                list_status=status,
                extra=json.dumps(extra_cols, ensure_ascii=False),
                imported_at=datetime.utcnow(),
            )
            db.add(entry)
            rows_saved += 1

        # Update meta
        meta = db.query(SatListMeta).first()
        if not meta:
            meta = SatListMeta()
            db.add(meta)
        meta.downloaded_at = datetime.utcnow()
        meta.row_count     = rows_saved
        meta.source_url    = source_url

        db.commit()
        logger.info("[SAT] Persisted %d rows to DB.", rows_saved)
        return rows_saved
    except Exception as exc:
        db.rollback()
        logger.error("[SAT] DB persist failed: %s", exc)
        return 0
    finally:
        db.close()


# ── Cache loading ──────────────────────────────────────────────────────────────

def _load_cache_from_db() -> int:
    """Read DB into _rfc_cache and _name_cache. Returns row count."""
    global _rfc_cache, _name_cache, _cache_loaded

    db: Session = SessionLocal()
    try:
        entries = db.query(SatBlacklistEntry).all()
        rfc_cache:  Dict[str, Dict[str, Any]] = {}
        name_cache: list[tuple[str, Dict[str, Any]]] = []

        for e in entries:
            row = {
                "rfc":          e.rfc,
                "company_name": e.company_name,
                "list_status":  e.list_status,
                "extra":        e.extra,
            }
            if e.rfc:
                rfc_cache[e.rfc] = row
            if e.company_name:
                name_cache.append((e.company_name, row))

        _rfc_cache   = rfc_cache
        _name_cache  = name_cache
        _cache_loaded = True
        logger.info("[SAT] Cache loaded: %d RFC entries, %d name entries.",
                    len(rfc_cache), len(name_cache))
        return len(entries)
    finally:
        db.close()


def _needs_refresh() -> bool:
    db: Session = SessionLocal()
    try:
        meta = db.query(SatListMeta).first()
        if not meta or not meta.downloaded_at:
            return True
        cutoff = datetime.utcnow() - timedelta(hours=settings.sat_refresh_interval_hours)
        return meta.downloaded_at < cutoff
    finally:
        db.close()


# ── Public API ─────────────────────────────────────────────────────────────────

def load_sat_list(force: bool = False) -> None:
    """
    Load the SAT blacklist into memory.
    Downloads a fresh copy if the DB is stale or force=True.
    Safe to call on startup; failures are logged but do not crash the app.
    """
    if not force and not _needs_refresh():
        count = _load_cache_from_db()
        logger.info("[SAT] Using cached list (%d entries).", count)
        return

    url = _find_download_url(settings.sat_page_url)
    if not url:
        logger.warning("[SAT] Could not find download URL. Loading existing DB cache.")
        _load_cache_from_db()
        return

    df = _download_and_parse(url)
    if df is None or df.empty:
        logger.warning("[SAT] Download/parse failed. Loading existing DB cache.")
        _load_cache_from_db()
        return

    saved = _persist_to_db(df, url)
    if saved > 0:
        _load_cache_from_db()
    else:
        logger.warning("[SAT] Nothing persisted. Loading existing DB cache.")
        _load_cache_from_db()


def refresh_sat_list() -> None:
    """Scheduled job entry-point — forces a fresh download."""
    logger.info("[SAT] Scheduled refresh started.")
    load_sat_list(force=True)


def is_vendor_in_blacklist(
    rfc: str,
    company_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Check whether a vendor's RFC (or name) appears in the SAT 69-B EFOS list.

    Args:
        rfc:          Vendor RFC (will be normalised internally).
        company_name: Optional company name for fuzzy fallback when RFC not found.

    Returns:
        {
          "is_in_list":  bool,
          "status":      "definitivo" | "presunto" | <other> | None,
          "details":     row_dict or None,
          "risk_level":  "high" | "medium" | None,
        }
    """
    if not _cache_loaded:
        # Cache not ready yet (e.g. startup download still in progress)
        logger.warning("[SAT] Cache not loaded; skipping blacklist check for RFC %s", rfc)
        return {"is_in_list": False, "status": None, "details": None, "risk_level": None}

    norm_rfc = _normalise_rfc(rfc)

    # ── Fast path: exact RFC match ─────────────────────────────────────────────
    if norm_rfc in _rfc_cache:
        row = _rfc_cache[norm_rfc]
        status = (row.get("list_status") or "").lower()
        risk   = "high" if "definitivo" in status else "medium"
        logger.info("[SAT] RFC %s found in blacklist (status=%s)", norm_rfc, status)
        return {"is_in_list": True, "status": status, "details": row, "risk_level": risk}

    # ── Fuzzy name fallback ────────────────────────────────────────────────────
    if company_name and _name_cache:
        norm_name = _normalise_name(company_name)
        names = [n for n, _ in _name_cache]
        match = fuzz_process.extractOne(
            norm_name,
            names,
            scorer=fuzz.WRatio,
            score_cutoff=settings.sat_name_match_threshold,
        )
        if match:
            matched_name, score, idx = match
            row    = _name_cache[idx][1]
            status = (row.get("list_status") or "").lower()
            risk   = "high" if "definitivo" in status else "medium"
            logger.info(
                "[SAT] Company '%s' fuzzy-matched '%s' (score=%.1f, status=%s)",
                norm_name, matched_name, score, status,
            )
            return {"is_in_list": True, "status": status, "details": row, "risk_level": risk}

    return {"is_in_list": False, "status": None, "details": None, "risk_level": None}
