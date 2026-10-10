"""
Độ chính xác của dự báo, đo bằng backtest: đứng ở từng ngày trong quá khứ, chỉ cho mô hình xem số đo tới hôm đó,
dự báo 1..7 ngày tới rồi so với số đo thật về sau. Có 5 năm số đo nên có kết quả ngay, không phải chờ
dự báo lưu hằng ngày tích lại.

Mỗi điểm đều so với "giữ nguyên số mới nhất" (persistence): mô hình không hơn được cách đó thì không đáng tin.
Cùng một hàm backtest dùng được cho mô hình mới (truyền forecaster khác), nên các mô hình được so trên cùng thước đo.
"""

import bisect
import json
import logging
from datetime import date, datetime, timedelta
from typing import Callable, Dict, List

import pandas as pd

from app.cache import get_redis
from app.config import get_settings
from app.services.predictor import STATISTICAL_VERSION, TIMEZONE, InsufficientDataError, statistical_forecast

logger = logging.getLogger(__name__)

HORIZONS = 7
# Biểu đồ "dự báo đặt cạnh số thật" dùng dự báo làm trước 3 ngày
SERIES_LEAD = 3
SERIES_DAYS = 90

# forecaster(chuỗi độ mặn theo ngày tới hôm qua, số ngày, hôm nay) -> các PredictionItem cho hôm nay+1..
Forecaster = Callable[[pd.Series, int, date], list]


def salinity_class(value: float) -> int:
    """Mức mặn như bản đồ và cảnh báo (frontend utils/metricScales): 0 thấp < 1‰, 1 trung bình 1–4‰, 2 cao > 4‰"""
    return 0 if value < 1 else 2 if value > 4 else 1


def backtest(daily_by_station: Dict[int, pd.Series], first_issue: date, last_issue: date,
             forecaster: Forecaster = statistical_forecast, lookback_days: int = 90) -> pd.DataFrame:
    """
    Mỗi ngày phát hành dự báo D (như job dự báo buổi sáng của backend), mô hình thấy số đo tới hết D-1 trong lookback_days ngày,
    dự báo D+1..D+7. Trả về mỗi dòng một cặp (dự báo, số thật) kèm persistence = số đo mới nhất lúc phát hành.
    """
    rows = []
    for station_id, series in daily_by_station.items():
        days: List[date] = list(series.index)
        values = series.to_dict()
        for offset in range((last_issue - first_issue).days + 1):
            issue = first_issue + timedelta(days=offset)
            end = bisect.bisect_left(days, issue)                       # chỉ số đo trước ngày phát hành
            start = bisect.bisect_left(days, issue - timedelta(days=lookback_days))
            history = series.iloc[start:end]
            if history.empty:
                continue
            try:
                predictions = forecaster(history, HORIZONS, issue)
            except InsufficientDataError:
                continue
            persistence = float(history.iloc[-1])
            for lead, p in enumerate(predictions, start=1):
                actual = values.get(p.date)
                if actual is not None:
                    rows.append((station_id, issue, lead, p.date, float(p.salinity), persistence, float(actual)))
    return pd.DataFrame(rows, columns=["station_id", "issued", "lead", "date", "predicted", "persistence", "actual"])


def _lead_summary(df: pd.DataFrame) -> List[dict]:
    out = []
    for lead, g in df.groupby("lead"):
        model_class = g["predicted"].map(salinity_class)
        actual_class = g["actual"].map(salinity_class)
        out.append({
            "lead": int(lead),
            "count": int(len(g)),
            "mae": round(float((g["predicted"] - g["actual"]).abs().mean()), 3),
            "persistenceMae": round(float((g["persistence"] - g["actual"]).abs().mean()), 3),
            # Tỉ lệ đoán đúng mức mặn (thấp / trung bình / cao), điều người dùng thật sự cần
            "levelAccuracy": round(float((model_class == actual_class).mean()), 3),
        })
    return out


def summarize(df: pd.DataFrame, first_issue: date, last_issue: date, model_version: str) -> dict:
    stations = []
    for station_id, g in df.groupby("station_id"):
        recent = g[(g["lead"] == SERIES_LEAD) & (g["date"] > last_issue - timedelta(days=SERIES_DAYS))].sort_values("date")
        stations.append({
            "stationId": int(station_id),
            "byLead": _lead_summary(g),
            "series": [{"date": d.isoformat(), "actual": a, "predicted": p}
                       for d, a, p in zip(recent["date"], recent["actual"], recent["predicted"])],
        })
    return {
        "modelVersion": model_version,
        "from": first_issue.isoformat(),
        "to": last_issue.isoformat(),
        "seriesLead": SERIES_LEAD,
        "byLead": _lead_summary(df) if not df.empty else [],
        "stations": stations,
    }


def load_daily_salinity(since: date) -> Dict[int, pd.Series]:
    """Độ mặn cao nhất theo ngày (giờ VN) của mọi trạm từ ngày since, mỗi trạm một Series tăng dần theo ngày."""
    from sqlalchemy import text
    from app.db import get_engine

    query = text("""
        SELECT station_id, (recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, MAX(value) AS value
        FROM measurements
        WHERE metric_type = 'salinity' AND value IS NOT NULL AND recorded_at >= :since
        GROUP BY 1, 2
        ORDER BY 1, 2
    """)
    with get_engine().connect() as conn:
        df = pd.read_sql(query, conn, params={"since": datetime.combine(since, datetime.min.time(), TIMEZONE)})
    return {int(sid): pd.Series(g["value"].astype(float).values, index=list(g["day"]))
            for sid, g in df.groupby("station_id")}


def accuracy(days: int = 180) -> dict:
    """Backtest mô hình đang dùng trên `days` ngày gần nhất, lưu Redis tới hết ngày (dữ liệu mỗi ngày về một lần)."""
    today = datetime.now(TIMEZONE).date()
    key = f"evaluation:accuracy:{STATISTICAL_VERSION}:{days}:{today.isoformat()}"
    try:
        cached = get_redis().get(key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis unavailable, skip accuracy cache read: {e}")

    lookback = get_settings().default_lookback_days
    first_issue, last_issue = today - timedelta(days=days), today
    daily = load_daily_salinity(first_issue - timedelta(days=lookback))
    result = summarize(backtest(daily, first_issue, last_issue, lookback_days=lookback), first_issue, last_issue, STATISTICAL_VERSION)

    try:
        get_redis().set(key, json.dumps(result), ex=24 * 3600)
    except Exception as e:
        logger.warning(f"Redis unavailable, skip accuracy cache write: {e}")
    return result
