"""
Thư mục inbox: thả file xuất từ RYNAN vào đây, job định kỳ sẽ nạp vào DB.
Nạp xong chuyển sang processed/, lỗi chuyển sang failed/ kèm <tên>.error.txt.
"""

import logging
import shutil
import time
from datetime import datetime
from pathlib import Path

from app.config import get_settings
from app.ingest.loader import import_file

logger = logging.getLogger(__name__)

EXTENSIONS = {".csv", ".xlsx", ".xls"}
# File vừa sửa trong khoảng này có thể vẫn đang được chép vào, để lần sau
MIN_AGE_SECONDS = 60


def _move(file: Path, target_dir: Path) -> Path:
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{datetime.now():%Y%m%d-%H%M%S}_{file.name}"
    shutil.move(str(file), target)
    return target


def process_inbox(inbox_dir=None, min_age_seconds: int = MIN_AGE_SECONDS) -> list:
    inbox = Path(inbox_dir or get_settings().ingest_inbox_dir)
    if not inbox.is_dir():
        logger.debug(f"Không có thư mục inbox {inbox}, bỏ qua.")
        return []

    now = time.time()
    files = sorted(
        f for f in inbox.iterdir()
        if f.is_file() and f.suffix.lower() in EXTENSIONS and now - f.stat().st_mtime >= min_age_seconds
    )

    reports = []
    for file in files:
        try:
            reports.append(import_file(file))
            _move(file, inbox / "processed")
        except Exception as e:
            logger.error(f"Nạp file {file.name} thất bại: {e}", exc_info=True)
            target = _move(file, inbox / "failed")
            target.with_name(target.name + ".error.txt").write_text(f"{type(e).__name__}: {e}\n", encoding="utf-8")
    return reports
