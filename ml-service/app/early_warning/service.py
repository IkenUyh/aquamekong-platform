"""
Mô hình rủi ro mặn chạy thật.

- refresh() (job định kỳ, app/pipeline/scheduler.py): khi có số đo mới thì học lại trên mọi số đo, và chạy lại trên
  từng mùa khô cũ: mỗi mùa một mô hình chỉ học các ngày trước mùa đó, rồi dự báo từng sáng của mùa như app chạy thật.
  Kết quả lưu ở model_dir/early_warning: model.joblib, meta.json (điểm từng mùa), backtest.json (dự báo từng sáng,
  cho trang Phát lại). File joblib chỉ do chính service này ghi vào volume model, không nhận file từ ngoài.
- forecast(): dự báo cho Predictor. Độ mặn dự báo giữ nguyên số mới nhất (sai số trung bình thấp nhất); risk_salinity
  (mức có thể lên tới) là phân vị 80% của mô hình; khoảng dự báo là phân vị 20%–80%, nới ra cho chứa số dự báo.
- replay_episodes(): cảnh báo sớm mà app lẽ ra đã gửi trong các mùa khô cũ, theo ngưỡng của từng trạm.
"""

import json
import logging
import os
import threading
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import joblib
import numpy as np
import pandas as pd
import sklearn

from app.config import get_settings
from app.early_warning import episodes as ep
from app.early_warning.features import MAX_HORIZON, build_rows, load_panel
from app.early_warning.model import LOWER_QUANTILE, UPPER_QUANTILE, RiskModel, station_codes
from app.schemas.forecast import PredictionItem
from app.services import data_loader

logger = logging.getLogger(__name__)

MODEL_VERSION = "gb-risk-v1"
TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
# Số đo mới nhất cũ hơn mức này (trạm mất tín hiệu) thì không dùng mô hình, như backend bỏ số đo cũ hơn 3 ngày
MAX_DATA_AGE_DAYS = 3
# Ngưỡng chấm điểm: cảnh báo chung 4‰ và các ngưỡng gợi ý theo cây trồng (frontend utils/crops.ts)
THRESHOLDS = (4.0, 2.0, 1.0, 0.5)
# Mùa khô chỉ được chạy lại khi trước đó có ít nhất một năm số đo để học
MIN_HISTORY_DAYS = 365


def dry_seasons(first_day: date, last_day: date) -> List[Tuple[str, date, date]]:
    """Mùa khô ĐBSCL (01/12 – 31/05) có dữ liệu và đủ một năm số đo trước đó; mùa đang diễn ra tính tới ngày cuối."""
    seasons = []
    for year in range(first_day.year + 1, last_day.year + 2):
        start, end = date(year - 1, 12, 1), min(date(year, 5, 31), last_day)
        if start <= last_day and start - timedelta(days=MIN_HISTORY_DAYS) >= first_day:
            seasons.append((f"Mùa khô {year - 1}–{year}", start, end))
    return seasons


def _daily_salinity(panel: pd.DataFrame) -> Dict[int, Dict[date, float]]:
    known = panel[panel["salinity"].notna()]
    return {int(sid): dict(zip(g["day"].dt.date, g["salinity"].astype(float)))
            for sid, g in known.groupby("station_id")}


def _round(value: float) -> Optional[float]:
    return None if value is None or np.isnan(value) else round(float(value), 2)


def _season_grid(test: pd.DataFrame, start: date, end: date) -> Dict[str, dict]:
    """Mỗi trạm: số mới nhất và mức có thể lên tới (+1..+7 ngày) của từng sáng trong mùa; None = sáng đó không có dự báo."""
    days = (end - start).days + 1
    stations = {}
    for sid, g in test.groupby("station_id"):
        latest: List[Optional[float]] = [None] * days
        risk: List[Optional[List[Optional[float]]]] = [None] * days
        wide = g.pivot(index="issued", columns="h", values="upper").reindex(columns=range(1, ep.WARNING_HORIZON + 1))
        s0 = g[g["h"] == 1].set_index("issued")["s0"]
        for issued, levels in wide.iterrows():
            i = (issued.date() - start).days
            latest[i] = _round(s0.get(issued))
            risk[i] = [_round(v) for v in levels.to_numpy(dtype=float)]
        stations[str(int(sid))] = {"latest": latest, "risk": risk}
    return stations


def train_all(panel: pd.DataFrame, data_version=None) -> Tuple[RiskModel, dict, dict]:
    """Học mô hình trên mọi số đo, và chạy lại trên từng mùa khô cũ. Trả về (mô hình, meta, backtest)."""
    codes = station_codes(panel)
    rows = build_rows(panel, station_codes=codes)
    known = rows[rows["target"].notna()]
    model = RiskModel.train(known)

    salinity_days = panel.loc[panel["salinity"].notna(), "day"]
    first_day, last_day = salinity_days.min().date(), salinity_days.max().date()
    daily = _daily_salinity(panel)
    seasons_meta, seasons_data = [], []
    for label, start, end in dry_seasons(first_day, last_day):
        start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)
        fold = RiskModel.train(known[known["target_day"] < start_ts])
        test = rows[(rows["issued"] >= start_ts) & (rows["issued"] <= end_ts) & (rows["h"] <= ep.WARNING_HORIZON)]
        lower, upper = fold.predict(test)
        test = test.assign(lower=lower, upper=upper)

        scored = test[test["target"].notna() & (test["target_day"] <= end_ts)]
        grid = _season_grid(test, start, end)
        thresholds = []
        for threshold in THRESHOLDS:
            scores = [ep.score(ep.simulate(start, data["latest"], data["risk"], threshold),
                               ep.onsets(daily.get(int(sid), {}), threshold, start, end))
                      for sid, data in grid.items()]
            thresholds.append({"threshold": threshold, **ep.merge_scores(scores)})
        seasons_meta.append({
            "label": label, "from": start.isoformat(), "to": end.isoformat(),
            "trainedUntil": (start - timedelta(days=1)).isoformat(),
            "stations": len(grid),
            # Khoảng phân vị 20%–80% chứa số thật bao nhiêu phần (lý thuyết 60%), và số thật vượt mức "có thể lên tới"
            # bao nhiêu phần (lý thuyết 20%)
            "coverage": round(float(((scored["lower"] <= scored["target"]) & (scored["target"] <= scored["upper"])).mean()), 3)
            if len(scored) else None,
            "aboveUpper": round(float((scored["target"] > scored["upper"]).mean()), 3) if len(scored) else None,
            "thresholds": thresholds,
        })
        seasons_data.append({"label": label, "from": start.isoformat(), "to": end.isoformat(), "stations": grid})

    meta = {
        "modelVersion": MODEL_VERSION,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "trainedUntil": last_day.isoformat(),
        "dataVersion": data_version,
        "sklearnVersion": sklearn.__version__,
        "stationCodes": {str(k): v for k, v in codes.items()},
        "lowerQuantile": LOWER_QUANTILE,
        "upperQuantile": UPPER_QUANTILE,
        "warningHorizon": ep.WARNING_HORIZON,
        "seasons": seasons_meta,
    }
    return model, meta, {"seasons": seasons_data}


def _write_atomic(path: Path, write) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    write(tmp)
    os.replace(tmp, path)


class EarlyWarningService:

    def __init__(self, model_dir: Optional[str] = None):
        self._dir = Path(model_dir or get_settings().model_dir) / "early_warning"
        self._lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._live_lock = threading.Lock()
        self._loaded = False
        self._model: Optional[RiskModel] = None
        self._meta: Optional[dict] = None
        self._backtest: Optional[dict] = None
        self._live_key = None
        self._live: Dict[int, dict] = {}

    def _ensure_loaded(self) -> None:
        with self._lock:
            if self._loaded:
                return
            self._loaded = True
            meta_path = self._dir / "meta.json"
            if not meta_path.exists():
                return
            try:
                meta = json.loads(meta_path.read_text())
                if meta.get("sklearnVersion") != sklearn.__version__:
                    logger.info("Mô hình rủi ro mặn lưu bằng scikit-learn %s, đang chạy %s: chờ học lại",
                                meta.get("sklearnVersion"), sklearn.__version__)
                    return
                model = joblib.load(self._dir / "model.joblib")
                backtest = json.loads((self._dir / "backtest.json").read_text())
                self._model, self._meta, self._backtest = model, meta, backtest
            except Exception as e:
                logger.warning(f"Không đọc được mô hình rủi ro mặn đã lưu, chờ học lại: {e}")

    def stamp(self) -> str:
        """Đổi mỗi lần học lại; Predictor ghép vào khoá cache dự báo."""
        self._ensure_loaded()
        return self._meta["trainedAt"] if self._meta else "none"

    def refresh(self, force: bool = False) -> bool:
        """Học lại khi số đo đổi (id số đo mới nhất khác lần học trước) hoặc force. True nếu đã học lại."""
        if not self._refresh_lock.acquire(blocking=False):
            return False
        try:
            self._ensure_loaded()
            version = data_loader.latest_measurement_id()
            if not force and self._meta is not None and self._meta.get("dataVersion") == version:
                return False
            panel = load_panel()
            if panel["salinity"].notna().sum() == 0:
                return False
            started = datetime.now(timezone.utc)
            model, meta, backtest = train_all(panel, version)
            self._save(model, meta, backtest)
            with self._lock:
                self._model, self._meta, self._backtest = model, meta, backtest
                self._live_key, self._live = None, {}
            took = (datetime.now(timezone.utc) - started).total_seconds()
            logger.info(f"Đã học lại mô hình rủi ro mặn (dữ liệu tới {meta['trainedUntil']}, "
                        f"{len(meta['seasons'])} mùa khô chạy lại) trong {took:.0f}s")
            return True
        finally:
            self._refresh_lock.release()

    def _save(self, model: RiskModel, meta: dict, backtest: dict) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        _write_atomic(self._dir / "model.joblib", lambda p: joblib.dump(model, p))
        _write_atomic(self._dir / "backtest.json", lambda p: p.write_text(json.dumps(backtest)))
        # meta ghi sau cùng: có meta nghĩa là hai file kia đã đủ
        _write_atomic(self._dir / "meta.json", lambda p: p.write_text(json.dumps(meta, ensure_ascii=False)))

    def _live_table(self) -> Dict[int, dict]:
        """Dự báo của mọi trạm cho lần phát hành mới nhất, tính một lần cho mỗi phiên bản dữ liệu và mô hình."""
        key = (data_loader.latest_measurement_id(), self._meta["trainedAt"])
        with self._live_lock:
            if self._live_key == key:
                return self._live
            codes = {int(k): v for k, v in self._meta["stationCodes"].items()}
            rows = build_rows(load_panel(), station_codes=codes, live=True)
            lower, upper = self._model.predict(rows)
            rows = rows.assign(lower=lower, upper=upper)
            table = {}
            for sid, g in rows.groupby("station_id"):
                issued = g["issued"].iloc[0].date()
                table[int(sid)] = {
                    "last_day": issued - timedelta(days=1),
                    "level": float(g["s0"].iloc[0]),
                    "lower": dict(zip(g["h"].astype(int), g["lower"].astype(float))),
                    "upper": dict(zip(g["h"].astype(int), g["upper"].astype(float))),
                }
            self._live_key, self._live = key, table
            return table

    def forecast(self, station_id: int, days_ahead: int, today: Optional[date] = None) -> Optional[List[PredictionItem]]:
        """Dự báo cho các ngày hôm nay+1..+days_ahead (giờ VN); None khi chưa có mô hình, trạm mất tín hiệu hoặc quá xa."""
        self._ensure_loaded()
        if self._model is None:
            return None
        today = today or datetime.now(TIMEZONE).date()
        entry = self._live_table().get(int(station_id))
        if entry is None or (today - entry["last_day"]).days > MAX_DATA_AGE_DAYS:
            return None
        level = round(entry["level"], 2)
        items = []
        for i in range(1, days_ahead + 1):
            day = today + timedelta(days=i)
            h = (day - entry["last_day"]).days - 1        # phát hành ngày sau ngày cuối có số đo
            if h not in entry["upper"]:
                return None
            risk = round(entry["upper"][h], 2)
            items.append(PredictionItem(
                date=day, salinity=level, lower_bound=min(round(entry["lower"][h], 2), level), upper_bound=max(risk, level),
                risk_salinity=risk, confidence=round(UPPER_QUANTILE - LOWER_QUANTILE, 2), model_version=MODEL_VERSION,
            ))
        return items

    def evaluation(self) -> Optional[dict]:
        """Điểm cảnh báo sớm trên từng mùa khô cũ (trang Dự báo); None khi chưa học xong lần đầu."""
        self._ensure_loaded()
        if self._meta is None:
            return None
        keys = ("modelVersion", "trainedAt", "trainedUntil", "lowerQuantile", "upperQuantile", "warningHorizon", "seasons")
        return {k: self._meta[k] for k in keys}

    def replay_episodes(self, first: date, last: date, thresholds: Dict[int, float]) -> dict:
        """Cảnh báo sớm lẽ ra đã gửi trong [first, last], mỗi trạm theo ngưỡng của nó; chỉ có trong các mùa khô đã chạy lại."""
        self._ensure_loaded()
        if self._backtest is None:
            return {"available": False, "seasons": [], "stations": {}}
        seasons, stations = [], {}
        for season in self._backtest["seasons"]:
            start, end = date.fromisoformat(season["from"]), date.fromisoformat(season["to"])
            if end < first or start > last:
                continue
            seasons.append({"label": season["label"], "from": season["from"], "to": season["to"]})
            for sid, data in season["stations"].items():
                threshold = thresholds.get(int(sid))
                if threshold is None:
                    continue
                for warning in ep.early_warnings(ep.simulate(start, data["latest"], data["risk"], threshold)):
                    item = warning.to_json()
                    if warning.start <= last and (item["end"] is None or item["end"] >= first.isoformat()):
                        stations.setdefault(sid, []).append(item)
        return {"available": True, "modelVersion": self._meta["modelVersion"], "seasons": seasons, "stations": stations}


early_warning = EarlyWarningService()
