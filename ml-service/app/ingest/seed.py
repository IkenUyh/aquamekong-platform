"""
Nạp dữ liệu ban đầu từ link Google Drive (SEED_DATA_URL) khi DB chưa có dữ liệu trạm thật.
Dùng cho máy mới clone về: điền link vào .env, chạy docker compose up là có dữ liệu.
Link nằm trong .env (không lên git) vì dữ liệu RYNAN không được công khai.
"""

import logging
import re
import tempfile
from pathlib import Path

import requests
from sqlalchemy import text

from app.config import get_settings
from app.db import get_engine
from app.ingest.loader import import_file
from app.ingest.stations import DEMO_STATION_CODES

logger = logging.getLogger(__name__)

_DRIVE_ID = re.compile(r"(?:/file/d/|[?&]id=)([\w-]{20,})")


def to_download_url(url: str) -> str:
    """Link chia sẻ Google Drive (…/file/d/<id>/view) → link tải trực tiếp; link khác giữ nguyên."""
    match = _DRIVE_ID.search(url) if "drive.google.com" in url else None
    if not match:
        return url
    # confirm=t bỏ qua trang cảnh báo "không quét được virus" của file lớn
    return f"https://drive.usercontent.google.com/download?id={match.group(1)}&export=download&confirm=t"


def has_real_data(conn) -> bool:
    return conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM measurements m JOIN stations s ON s.id = m.station_id
            WHERE s.code <> ALL(:demo)
        )
    """), {"demo": list(DEMO_STATION_CODES)}).scalar()


def _filename(response, default: str = "seed.csv") -> str:
    match = re.search(r'filename="?([^";]+)"?', response.headers.get("Content-Disposition", ""))
    return Path(match.group(1)).name if match else default


def download(url: str, target_dir: Path) -> Path:
    with requests.get(to_download_url(url), stream=True, timeout=(10, 300)) as response:
        response.raise_for_status()
        if "text/html" in response.headers.get("Content-Type", ""):
            raise RuntimeError(
                "Link trả về trang web thay vì file. Trên Google Drive, đặt quyền chia sẻ "
                "'Bất kỳ ai có đường liên kết' cho file này."
            )
        path = target_dir / _filename(response)
        with open(path, "wb") as f:
            for chunk in response.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    return path


def seed_if_empty(url: str = None, engine=None):
    url = url if url is not None else get_settings().seed_data_url
    if not url:
        return None
    engine = engine or get_engine()
    with engine.connect() as conn:
        if has_real_data(conn):
            logger.info("DB đã có dữ liệu trạm thật, bỏ qua SEED_DATA_URL.")
            return None

    logger.info("DB chưa có dữ liệu trạm thật, tải dữ liệu từ SEED_DATA_URL...")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            return import_file(download(url, Path(tmp)), engine=engine)
    except Exception as e:
        logger.error(f"Nạp dữ liệu từ SEED_DATA_URL thất bại: {e}", exc_info=True)
        return None
