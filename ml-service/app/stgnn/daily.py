"""
ST-GNN daily (scripts/train_stgnn_daily.py): dự báo độ mặn 1..8 ngày sau ngày có số đo cuối cho các trạm của đồ thị,
chỉ từ số đo RYNAN hằng ngày (độ mặn, mực nước) và thông số tĩnh của trạm, nên chạy được mỗi ngày.

File trong app/stgnn/daily/ (đóng vào image, ghi bởi `python -m app.stgnn.daily_install`): meta.json (trạm, đặc trưng,
tham số scaler, toạ độ, khoảng cách, ma trận đồ thị), h{n}.pth (state_dict, đọc với weights_only=True) và
evaluation.json (scripts/benchmark_stgnn_daily.py). Lúc chạy không mở pickle.

Tiền xử lý y như lúc train: 11 đặc trưng (công thức khớp 100% với kho feature), mực nước theo cm, nội suy theo hàng xóm
(IDW theo ma trận đồ thị) rồi theo thời gian.

blend(): số dự báo app hiển thị ở các trạm này. Chạy lại từng mùa (mùa khô 2024–25, 2025–26 học trước 01/12; mùa mưa
2026 ngoài mẫu), đích là số đo thật: ST-GNN hơn gb-risk-v2 (lúc đó còn giữ nguyên số) ở 2..4 ngày sau số đo cuối,
còn ở 5..8 ngày trung bình hai mô hình hơn cả hai mô hình đứng riêng.
"""

import json
import logging
import threading
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Callable, Dict, List, Optional

import numpy as np
import pandas as pd
import torch

from app.models.st_gnn import STGNN
from app.schemas.forecast import PredictionItem

logger = logging.getLogger(__name__)

ARTIFACT_DIR = Path(__file__).parent / "daily"
META_FILE = "meta.json"
EVALUATION_FILE = "evaluation.json"
# Đủ cho cửa sổ 14 ngày, đặc trưng trễ 8 ngày và nội suy
WINDOW_DAYS = 60
# Như mô hình rủi ro: số đo mới nhất cũ hơn mức này thì trạm mất tín hiệu, không dự báo
MAX_DATA_AGE_DAYS = 3
# Ngày sau số đo cuối: tới mốc này lấy số ST-GNN, sau đó (tới mốc lớn nhất) trung bình với gb-risk-v2
STGNN_ONLY_TO = 4


@dataclass
class StationForecast:
    horizon: int
    date: date
    q10: float
    q50: float
    q90: float


@dataclass
class DailyGraph:
    data_end: date
    last_day: Dict[str, date]
    by_station: Dict[str, List[StationForecast]]


def station_features(salinity: pd.Series, water_level_cm: pd.Series, static: dict, days: pd.DatetimeIndex,
                     feature_cols: List[str]) -> pd.DataFrame:
    """
    Đặc trưng của một trạm theo ngày (index = days), như kho feature: ngày không có số đo độ mặn thì mọi đặc trưng
    đo đạc để trống (nội suy sau). salinity, water_level_cm: Series theo ngày, có thể thiếu ngày.
    """
    s = salinity.reindex(days)
    wl = water_level_cm.reindex(days)
    f = pd.DataFrame(index=days)
    f["distance_to_river_mouth_km"] = static["distance_to_river_mouth_km"]
    f["distance_to_coast_km"] = static["distance_to_coast_km"]
    f["salinity_max_lag_1d"] = s.shift(1)
    f["salinity_max_delta_3d"] = s.shift(1) - s.shift(4)
    f["salinity_max_delta_7d"] = s.shift(1) - s.shift(8)
    f["water_level_max_lag_1d"] = wl.shift(1)
    f["water_level_max_lag_7d"] = wl.shift(7)
    f["water_level_max_roll7d_std"] = wl.shift(1).rolling(7, min_periods=1).std()
    f["day_of_year_sin"] = np.sin(2 * np.pi * days.dayofyear / 365.25)
    f["day_of_year_cos"] = np.cos(2 * np.pi * days.dayofyear / 365.25)
    f["salinity_max"] = s
    measured = [c for c in feature_cols if c.startswith(("salinity", "water"))]
    f.loc[s.isna(), measured] = np.nan
    return f[feature_cols]


def impute(frames: Dict[str, pd.DataFrame], codes: List[str], feature_cols: List[str], w_d: np.ndarray) -> np.ndarray:
    """(ngày, trạm, đặc trưng) sau nội suy IDW theo hàng xóm rồi theo thời gian, như DataLoaderService lúc train."""
    days = next(iter(frames.values())).index
    neighbors = w_d.copy()
    np.fill_diagonal(neighbors, 0)
    out = {}
    for feat in feature_cols:
        x = np.column_stack([frames[c][feat].to_numpy(dtype=float) for c in codes])
        mask = ~np.isnan(x)
        imputed = (np.nan_to_num(x) @ neighbors) / (mask @ neighbors + 1e-8)
        filled = np.where(mask, x, imputed)
        filled[filled == 0] = np.nan
        out[feat] = pd.DataFrame(filled, index=days, columns=codes)
    stacked = pd.concat(out, axis=1).interpolate(method="time", limit=5, limit_direction="both").ffill().bfill().fillna(0)
    return np.stack([stacked[feat][codes].to_numpy() for feat in feature_cols], axis=-1)


def _load_recent(codes: List[str]) -> pd.DataFrame:
    """Độ mặn và mực nước (cm) cao nhất theo ngày của các trạm, WINDOW_DAYS ngày gần nhất: cột code, day, salinity, water_level."""
    from sqlalchemy import text
    from app.db import get_engine

    query = text("""
        SELECT s.code, (m.recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, m.metric_type, MAX(m.value) AS value
        FROM measurements m JOIN stations s ON s.id = m.station_id
        WHERE s.code = ANY(:codes) AND m.metric_type IN ('salinity', 'water_level') AND m.value IS NOT NULL
          AND m.recorded_at >= NOW() - make_interval(days => :days)
        GROUP BY 1, 2, 3
    """)
    with get_engine().connect() as conn:
        raw = pd.read_sql(query, conn, params={"codes": codes, "days": WINDOW_DAYS + 10})
    if raw.empty:
        return pd.DataFrame(columns=["code", "day", "salinity", "water_level"])
    wide = raw.pivot_table(index=["code", "day"], columns="metric_type", values="value", aggfunc="max").reset_index()
    for col in ("salinity", "water_level"):
        if col not in wide:
            wide[col] = np.nan
    wide["day"] = pd.to_datetime(wide["day"])
    wide["water_level"] = wide["water_level"] * 100          # DB lưu m, mô hình học cm
    return wide


class DailyForecaster:
    def __init__(self, artifact_dir: Path = ARTIFACT_DIR, loader: Callable[[List[str]], pd.DataFrame] = _load_recent):
        self.dir = Path(artifact_dir)
        self.loader = loader
        self._lock = threading.Lock()
        self._meta: Optional[dict] = None
        self._models: Dict[int, STGNN] = {}
        self._key = None
        self._graph: Optional[DailyGraph] = None

    def meta(self) -> Optional[dict]:
        if self._meta is None and (self.dir / META_FILE).exists():
            self._meta = json.loads((self.dir / META_FILE).read_text())
        return self._meta

    def evaluation(self) -> Optional[list]:
        path = self.dir / EVALUATION_FILE
        return json.loads(path.read_text()) if path.exists() else None

    def version(self) -> str:
        meta = self.meta()
        return meta["model_version"] if meta else "none"

    def _model(self, meta: dict, horizon: int) -> STGNN:
        if horizon not in self._models:
            model = STGNN(num_stations=len(meta["stations"]), num_features=len(meta["feature_cols"]),
                          lookback=meta["lookback"], horizon=horizon)
            model.load_state_dict(torch.load(self.dir / f"h{horizon}.pth", map_location="cpu", weights_only=True))
            model.eval()
            self._models[horizon] = model
        return self._models[horizon]

    def graph(self, today: date, data_version=None) -> Optional[DailyGraph]:
        """Dự báo cho cả đồ thị, tính một lần cho mỗi phiên bản dữ liệu (id số đo mới nhất) và ngày."""
        meta = self.meta()
        if meta is None:
            return None
        key = (data_version, today)
        with self._lock:
            if data_version is None or key != self._key:
                self._graph = self._run(meta, today)
                self._key = key
            return self._graph

    def _run(self, meta: dict, today: date) -> Optional[DailyGraph]:
        codes, feats = meta["stations"], meta["feature_cols"]
        data = self.loader(codes)
        known = data[data["salinity"].notna()]
        if known.empty:
            return None
        last_day = {c: d.date() for c, d in known.groupby("code")["day"].max().items()}
        end = max(last_day.values())
        if (today - end).days > MAX_DATA_AGE_DAYS:
            return None
        days = pd.date_range(end - timedelta(days=WINDOW_DAYS - 1), end, freq="D")
        frames = {}
        for code in codes:
            rows = data[data["code"] == code].set_index("day")
            frames[code] = station_features(rows.get("salinity", pd.Series(dtype=float)),
                                            rows.get("water_level", pd.Series(dtype=float)),
                                            meta["static"][code], days, feats)
        x = impute(frames, codes, feats, np.array(meta["w_d"]))
        lo, sc = np.array(meta["scaler"]["min_"]), np.array(meta["scaler"]["scale_"])
        x = x * sc + lo
        window = torch.tensor(np.transpose(x[-meta["lookback"]:], (1, 0, 2))[None], dtype=torch.float32)
        w_d = torch.tensor(np.array(meta["w_d"]), dtype=torch.float32)
        tgt = feats.index(meta["target_col"])
        by_station: Dict[str, List[StationForecast]] = {c: [] for c in codes}
        with torch.no_grad():
            for h in meta["horizons"]:
                q = self._model(meta, h)(window, w_d)[0].numpy()          # (trạm, 3): q10, q50, q90 đã chuẩn hoá
                q = np.clip((q - lo[tgt]) / sc[tgt], 0, None)
                for i, code in enumerate(codes):
                    q10, q50, q90 = sorted(float(v) for v in q[i])
                    by_station[code].append(StationForecast(h, end + timedelta(days=h), round(q10, 2), round(q50, 2), round(q90, 2)))
        return DailyGraph(end, last_day, by_station)

    def forecast(self, code: str, today: date, data_version=None) -> Optional[DailyGraph]:
        """Đồ thị nếu trạm có trong mô hình và chưa mất tín hiệu, không thì None."""
        meta = self.meta()
        if meta is None or code not in meta["stations"]:
            return None
        graph = self.graph(today, data_version)
        if graph is None or code not in graph.last_day or (today - graph.last_day[code]).days > MAX_DATA_AGE_DAYS:
            return None
        return graph


def blend(risk_items: List[PredictionItem], graph: DailyGraph, code: str, version: str) -> List[PredictionItem]:
    """
    Số dự báo của trạm: ST-GNN tới STGNN_ONLY_TO ngày sau số đo cuối, trung bình với số của gb-risk-v2 từ đó tới mốc lớn
    nhất của ST-GNN, xa hơn giữ số của gb-risk-v2. Mức có thể lên tới và khoảng dự báo vẫn của gb-risk-v2 (nới cho chứa số).
    """
    by_date = {f.date: f for f in graph.by_station[code]}
    out = []
    for item in risk_items:
        f = by_date.get(item.date)
        value = item.salinity
        if f is not None:
            value = f.q50 if f.horizon <= STGNN_ONLY_TO else round((f.q50 + item.salinity) / 2, 2)
        out.append(item.model_copy(update={
            "salinity": value,
            "lower_bound": min(item.lower_bound, value) if item.lower_bound is not None else None,
            "upper_bound": max(item.upper_bound, value) if item.upper_bound is not None else None,
            "model_version": version,
        }))
    return out


daily_forecaster = DailyForecaster()
