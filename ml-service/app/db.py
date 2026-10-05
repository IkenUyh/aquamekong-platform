"""
Shared SQLAlchemy engine — one connection pool for the whole process.
"""

from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from app.config import get_settings


def _with_driver(url: str) -> str:
    # SQLAlchemy 2.1 đổi driver mặc định của "postgresql://" sang psycopg (v3);
    # image chỉ cài psycopg2 nên chỉ định rõ driver.
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


@lru_cache()
def get_engine() -> Engine:
    return create_engine(_with_driver(get_settings().database_url), pool_pre_ping=True)
