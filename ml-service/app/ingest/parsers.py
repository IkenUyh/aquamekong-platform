"""
Đọc file dữ liệu (CSV/Excel) và chuẩn hoá về 2 bảng:
- stations: station_code, station_name, latitude, longitude
- measurements (dạng long): station_code, recorded_at, metric_type, value

Mỗi định dạng file có một parser; detect_format() chọn parser theo header.
Khi có file mẫu xuất từ app RYNAN (số đo thô), thêm parser vào FORMATS.
"""

from dataclasses import dataclass
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
    return ParsedFile("features", stations, measurements.reset_index(drop=True))


FORMATS = [
    ("features", FEATURES_REQUIRED, parse_features),
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
