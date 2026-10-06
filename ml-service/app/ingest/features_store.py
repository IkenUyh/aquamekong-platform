"""
Kho feature cho ST-GNN: một file CSV định dạng features (1 dòng / trạm / ngày) trong `features_dir`.
ST-GNN cần cả mưa, lưu lượng thượng nguồn, thủy triều... vốn không nằm trong bảng measurements,
nên mỗi lần nạp file features thì gộp thêm vào đây.
"""

import os
from pathlib import Path

import pandas as pd

from app.config import get_settings

# Tên file DataLoaderService tìm đầu tiên (app/pipeline/dataset_loader.py)
FEATURES_FILE = "AquaMekong_CLEAN_FEATURES_FINAL.csv"


def features_path(features_dir=None) -> Path:
    return Path(features_dir or get_settings().features_dir) / FEATURES_FILE


def append_features(df: pd.DataFrame, features_dir=None) -> int:
    """Gộp các dòng mới vào kho, trùng (station_id, date) thì giữ bản mới. Trả về số dòng trong kho."""
    path = features_path(features_dir)
    path.parent.mkdir(parents=True, exist_ok=True)

    new = df.copy()
    new["station_id"] = new["station_id"].astype(str).str.strip()
    new["date"] = pd.to_datetime(new["date"]).dt.strftime("%Y-%m-%d")
    if path.exists():
        merged = pd.concat([pd.read_csv(path, dtype={"station_id": str}), new], ignore_index=True)
    else:
        merged = new
    merged = (merged.drop_duplicates(subset=["station_id", "date"], keep="last")
              .sort_values(["station_id", "date"]).reset_index(drop=True))

    # Ghi file tạm rồi đổi tên: ST-GNN đang đọc không bao giờ thấy file ghi dở
    tmp = path.with_suffix(".csv.tmp")
    merged.to_csv(tmp, index=False)
    os.replace(tmp, path)
    return len(merged)
