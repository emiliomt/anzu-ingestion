"""
Application configuration loaded from environment variables.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Service identity
    app_name: str = "anzu-security"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./anzu_security.db"

    # SAT blacklist
    sat_refresh_interval_hours: int = 24
    sat_download_timeout_seconds: int = 60
    sat_page_url: str = (
        "http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/"
        "contribuyentes_publicados.html"
    )

    # Fuzzy matching thresholds (0–100 scale for rapidfuzz)
    name_match_threshold: float = 85.0
    address_match_threshold: float = 80.0
    sat_name_match_threshold: float = 85.0

    # Downstream matcher service
    matcher_url: str = ""          # e.g. https://anzu-matcher.railway.app/api/v1/ingest
    matcher_api_key: str = ""      # Bearer token for matcher

    # Optional Redis URL for SAT list cache (leave blank to use in-memory)
    redis_url: str = ""

    # Security for this service's own API
    api_key: str = ""              # If set, require X-Api-Key header on all requests

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
