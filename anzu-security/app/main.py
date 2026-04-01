"""
anzu-security — Invoice security middleware for Anzu Dynamics.

Sits between anzu-ingestion (OCR extraction) and anzu-matcher.
Checks:
  1. Buyer name, tax ID, and address against org-configured expected values.
  2. For Mexican invoices: vendor RFC against SAT Art.69-B EFOS blacklist.

If all checks pass the invoice is forwarded to anzu-matcher via HTTP POST.

Startup sequence:
  - Create DB tables
  - Load SAT blacklist into memory (download if stale)
  - Register APScheduler job for daily SAT refresh

Environment variables (see app/config.py for full list):
  DATABASE_URL          SQLite or PostgreSQL URL
  MATCHER_URL           Downstream anzu-matcher endpoint
  MATCHER_API_KEY       Bearer token for matcher
  API_KEY               (Optional) protect this service's own endpoints
  SAT_REFRESH_INTERVAL_HOURS   How often to re-download the SAT list (default 24)
"""
import logging
import threading
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import init_db
from app.routers import security as security_router
from app.routers import settings as settings_router
from app.services.sat_blacklist import load_sat_list, refresh_sat_list

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


# ── Startup / shutdown ─────────────────────────────────────────────────────────

_scheduler: BackgroundScheduler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler

    # 1. Initialise database
    init_db()
    logger.info("[Startup] Database tables ensured.")

    # 2. Load SAT blacklist (runs in a background thread so it doesn't block startup)
    def _load():
        try:
            load_sat_list()
        except Exception as exc:
            logger.error("[Startup] SAT list load failed: %s", exc)

    thread = threading.Thread(target=_load, daemon=True)
    thread.start()

    # 3. Schedule daily SAT refresh
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        refresh_sat_list,
        "interval",
        hours=settings.sat_refresh_interval_hours,
        id="sat_refresh",
    )
    _scheduler.start()
    logger.info(
        "[Startup] SAT refresh scheduled every %d hours.",
        settings.sat_refresh_interval_hours,
    )

    yield

    # Shutdown
    if _scheduler:
        _scheduler.shutdown(wait=False)
    logger.info("[Shutdown] Scheduler stopped.")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="anzu-security",
    description="Invoice security middleware — buyer verification & SAT blacklist checks.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Optional API key guard ─────────────────────────────────────────────────────

@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if not settings.api_key:
        return await call_next(request)

    # Allow health check without auth
    if request.url.path in ("/health", "/"):
        return await call_next(request)

    provided = request.headers.get("X-Api-Key") or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if provided != settings.api_key:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid or missing API key."},
        )
    return await call_next(request)


# ── Routes ─────────────────────────────────────────────────────────────────────

app.include_router(security_router.router)
app.include_router(settings_router.router)


@app.get("/", include_in_schema=False)
def root():
    return {"service": "anzu-security", "status": "ok"}


@app.get("/health", tags=["ops"])
def health():
    return {"status": "healthy"}
