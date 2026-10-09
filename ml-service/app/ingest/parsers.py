"""
Đọc file dữ liệu (CSV/Excel) và chuẩn hoá về 2 bảng:
- stations: station_code, station_name, latitude, longitude
- measurements (dạng long): station_code, recorded_at, metric_type, value

Mỗi định dạng file có một parser; detect_format() chọn parser theo header.
Khi có file mẫu xuất từ app RYNAN (số đo thô), thêm parser vào FORMATS.
"""

from dataclasses import dataclass
from typing import Optional
from pathlib import Path

import pandas as pd

TIMEZONE = "Asia/Ho_Chi_Minh"

STATION_COLUMNS = ["station_code", "station_name", "latitude", "longitude"]
MEASUREMENT_COLUMNS = ["station_code", "recorded_at", "metric_type", "value"]


class UnsupportedFormatError(ValueError):
    pass


@dataclass
class ParsedFile:
    format: str
    stations: pd.DataFrame
    measurements: pd.DataFrame
    # Bảng gốc của file định dạng features, để gộp vào kho feature cho ST-GNN
    features: Optional[pd.DataFrame] = None
    # False: chỉ nạp số đo cho trạm đã có trong DB, không tạo trạm mới
    creates_stations: bool = True


def read_table(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(path)
    raise UnsupportedFormatError(f"Không hỗ trợ loại file '{suffix}' (chỉ nhận .csv, .xlsx)")


# --- Định dạng "features": AquaMekong_CLEAN_FEATURES_FINAL.csv (1 dòng / trạm / ngày) ---

FEATURES_REQUIRED = {"station_id", "date", "salinity_max"}

# (cột CSV, metric_type, số ngày lùi so với cột date, hệ số đổi sang đơn vị của sensor)
# Các cột *_lag_1d là giá trị của ngày hôm trước, nên ghi vào ngày date - 1.
# Mực nước RYNAN tính bằng cm, sensor water_level dùng m.
FEATURES_METRICS = [
    ("salinity_max", "salinity", 0, 1.0),
    ("water_level_max_lag_1d", "water_level", 1, 0.01),
    ("upstream_discharge_lag_1d", "flow_rate", 1, 1.0),
]


def parse_features(df: pd.DataFrame) -> ParsedFile:
    df = df.copy()
    df["station_id"] = df["station_id"].astype(str).str.strip()
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()

    stations = (
        df.rename(columns={"station_id": "station_code"})
        .reindex(columns=STATION_COLUMNS)
        .assign(station_name=lambda s: s["station_name"].astype("string").str.strip())
        .groupby("station_code", as_index=False)
        .first()
    )

    parts = []
    for column, metric, shift_days, factor in FEATURES_METRICS:
        if column not in df.columns:
            continue
        part = df[["station_id", "date", column]].dropna(subset=[column])
        parts.append(pd.DataFrame({
            "station_code": part["station_id"],
            "recorded_at": (part["date"] - pd.Timedelta(days=shift_days)).dt.tz_localize(TIMEZONE),
            "metric_type": metric,
            "value": part[column].astype(float) * factor,
        }))

    measurements = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=MEASUREMENT_COLUMNS)
    measurements = measurements.drop_duplicates(subset=["station_code", "metric_type", "recorded_at"], keep="last")
    return ParsedFile("features", stations, measurements.reset_index(drop=True), features=df)


# --- Định dạng "rynan_raw": rynan_YYYY-MM-DD.csv do scripts/rynan_fetch.py ghi (1 dòng / trạm / metric / thời điểm).
# Script ghi giá trị cao nhất trong ngày lúc 00:00, giống salinity_max của định dạng features.

RYNAN_RAW_REQUIRED = {"station_code", "recorded_at", "metric", "value"}

# metric trong file → (metric_type, hệ số đổi sang đơn vị của sensor). Độ mặn g/L ≈ ‰.
# Metric khác (pH, nhiệt độ...) chưa có sensor CRAWLER nên bị bỏ.
RYNAN_RAW_METRICS = {
    "salinity": ("salinity", 1.0),
    "water_level": ("water_level", 0.01),
}


def _to_local_time(values: pd.Series) -> pd.Series:
    """Giờ không kèm múi giờ hiểu là giờ Việt Nam. Từng giá trị một vì file có thể lẫn cả hai loại."""
    def convert(value):
        t = pd.Timestamp(value)
        return t.tz_localize(TIMEZONE) if t.tz is None else t.tz_convert(TIMEZONE)
    return pd.to_datetime(values.map(convert))


def parse_rynan_raw(df: pd.DataFrame) -> ParsedFile:
    df = df.copy()
    df["station_code"] = df["station_code"].astype(str).str.strip()

    stations = (
        df.reindex(columns=STATION_COLUMNS)
        .assign(station_name=lambda s: s["station_name"].astype("string").str.strip())
        .groupby("station_code", as_index=False)
        .first()
    )

    df["metric"] = df["metric"].astype(str).str.strip().str.lower()
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df[df["metric"].isin(RYNAN_RAW_METRICS.keys())].dropna(subset=["value"])
    metric_type = df["metric"].map(lambda m: RYNAN_RAW_METRICS[m][0])
    factor = df["metric"].map(lambda m: RYNAN_RAW_METRICS[m][1])

    measurements = pd.DataFrame({
        "station_code": df["station_code"],
        "recorded_at": _to_local_time(df["recorded_at"]),
        "metric_type": metric_type,
        "value": df["value"].astype(float) * factor,
    }, columns=MEASUREMENT_COLUMNS)
    measurements = measurements.drop_duplicates(subset=["station_code", "metric_type", "recorded_at"], keep="last")
    # Không gộp vào kho feature ST-GNN: file này thiếu mưa, lưu lượng thượng nguồn, thủy triều...
    # RYNAN có hơn 100 trạm; hệ thống chỉ theo dõi các trạm của bộ dữ liệu gốc (file features)
    return ParsedFile("rynan_raw", stations, measurements.reset_index(drop=True), creates_stations=False)


FORMATS = [
    ("features", FEATURES_REQUIRED, parse_features),
    ("rynan_raw", RYNAN_RAW_REQUIRED, parse_rynan_raw),
]


def detect_format(columns) -> str:
    present = {str(c).strip() for c in columns}
    for name, required, _ in FORMATS:
        if required <= present:
            return name
    raise UnsupportedFormatError(
        "Không nhận diện được định dạng file. Các cột tìm thấy: " + ", ".join(sorted(present))
    )


def parse_file(path) -> ParsedFile:
    path = Path(path)
    df = read_table(path)
    df.columns = [str(c).strip() for c in df.columns]
    name = detect_format(df.columns)
    parser = next(p for n, _, p in FORMATS if n == name)
    return parser(df)
