"""
Predictor service: chọn mô hình dự báo cho trạm (ST-GNN, Prophet, Hybrid, xu hướng thống kê).
"""

import json
import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List, Optional
from app.cache import get_redis
from app.config import get_settings
from app.schemas.forecast import PredictionItem
from app.services.data_loader import latest_measurement_id, load_station_metrics, load_station_info
from app.models.hybrid_salinity_model import HybridSalinityModel
from app.models.salinity_model import SalinityModel
from app.stgnn.forecaster import forecaster as stgnn_forecaster

logger = logging.getLogger(__name__)

TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
# Dự báo thống kê cần ít nhất ngần này ngày có số đo trong khoảng lookback
MIN_STATISTICAL_DAYS = 3
STATISTICAL_VERSION = "statistical-v2"


class InsufficientDataError(ValueError):
    """Trạm không có đủ số đo gần đây cho mô hình nào, nên không dự báo (thay vì bịa số)."""


class Predictor:
    """Prediction pipeline for salinity forecasting."""

    def __init__(self):
        self.model = HybridSalinityModel()
        # Model Prophet riêng từng trạm, được train qua POST /api/v1/train
        self.prophet = SalinityModel()

    @staticmethod
    def _cache_key(station_id, days_ahead: int) -> str:
        # Ngày hiện tại (giờ VN): sang ngày mới thì dự báo làm mới. Phiên bản dữ liệu (id số đo mới nhất): số đo mới
        # nạp vào giữa ngày (file RYNAN về trễ) thì dự báo tính lại, không trả kết quả tính trên số đo cũ
        return (f"forecast:{station_id}:{days_ahead}:{datetime.now(TIMEZONE).date().isoformat()}"
                f":{latest_measurement_id()}")

    def _get_cached(self, key: str) -> Optional[List[PredictionItem]]:
        try:
            raw = get_redis().get(key)
        except Exception as e:
            logger.warning(f"Redis unavailable, skip forecast cache read: {e}")
            return None
        if raw is None:
            return None
        return [PredictionItem.model_validate(item) for item in json.loads(raw)]

    def invalidate(self, station_id) -> None:
        """Xoá cache dự báo của trạm (gọi sau khi train lại model)."""
        try:
            r = get_redis()
            for key in r.scan_iter(f"forecast:{station_id}:*"):
                r.delete(key)
        except Exception as e:
            logger.warning(f"Redis unavailable, skip forecast cache invalidation: {e}")

    def _set_cached(self, key: str, predictions: List[PredictionItem]) -> None:
        try:
            payload = json.dumps([p.model_dump(mode="json") for p in predictions])
            get_redis().set(key, payload, ex=get_settings().forecast_cache_ttl_seconds)
        except Exception as e:
            logger.warning(f"Redis unavailable, skip forecast cache write: {e}")

    def predict(self, station_id, days_ahead: int = 7) -> List[PredictionItem]:
        """
        Generate salinity predictions for a station (cached in Redis).
        Simulated fallbacks are not cached so real data/models take over as soon as available.
        """
        try:
            key = self._cache_key(station_id, days_ahead)
        except Exception as e:
            # Không biết phiên bản dữ liệu thì không dùng cache, tránh trả dự báo tính trên số đo cũ
            logger.warning(f"Cannot read data version, skip forecast cache: {e}")
            key = None
        cached = self._get_cached(key) if key else None
        if cached is not None:
            logger.info(f"Forecast cache hit for station {station_id}")
            return cached

        predictions = self._predict_uncached(station_id, days_ahead)
        if predictions and key:
            self._set_cached(key, predictions)
        return predictions

    def _predict_uncached(self, station_id, days_ahead: int) -> List[PredictionItem]:
        """
        Thứ tự: ST-GNN (trạm có trong model và tốt hơn giữ nguyên giá trị cũ) -> Prophet riêng của trạm
        -> Hybrid ARIMA-CNN (global) -> xu hướng thống kê.
        Mỗi mô hình lỗi thì rơi xuống tầng sau. Không đủ số đo cho tầng cuối thì InsufficientDataError.
        """
        stgnn = self._stgnn_forecast(station_id, days_ahead)
        if stgnn:
            return stgnn
        if self.prophet.has_trained_model(station_id):
            try:
                logger.info(f"Using Prophet model for station {station_id}")
                return self.prophet.predict(station_id, days_ahead)
            except Exception as e:
                logger.error(f"Prophet prediction failed for station {station_id}: {e}")

        if self.model.has_trained_model(station_id):
            try:
                logger.info(f"Using Hybrid ARIMA-CNN model for station {station_id}")
                return self.model.predict(station_id, days_ahead)
            except Exception as e:
                logger.error(f"Hybrid prediction failed for station {station_id}: {e}")

        df = load_station_metrics(station_id, lookback_days=get_settings().default_lookback_days)
        if df.empty or "salinity" not in df:
            raise InsufficientDataError(f"Trạm {station_id} không có số đo độ mặn trong "
                                        f"{get_settings().default_lookback_days} ngày qua")
        logger.info(f"No trained model for station {station_id}, using statistical estimation")
        return self._statistical_forecast(df, days_ahead)

    def _stgnn_forecast(self, station_id, days_ahead: int) -> Optional[List[PredictionItem]]:
        try:
            code = load_station_info(station_id)["code"]
            graph = stgnn_forecaster.forecast(code, days_ahead)
            if graph is None:
                return None
            age = (datetime.now(TIMEZONE).date() - graph.data_end).days
            if age > get_settings().stgnn_max_data_age_days:
                logger.info(f"ST-GNN data ends {graph.data_end} ({age} days ago), using another model for station {station_id}")
                return None
            version = stgnn_forecaster.meta()["model_version"]
            logger.info(f"Using ST-GNN for station {station_id} ({code}), data until {graph.data_end}")
            return [
                PredictionItem(date=f.date, salinity=f.q50, lower_bound=f.q10, upper_bound=f.q90,
                               confidence=0.8, model_version=version, data_end=graph.data_end)
                for f in graph.by_station[code]
            ]
        except Exception as e:
            logger.error(f"ST-GNN prediction failed for station {station_id}: {e}", exc_info=True)
            return None

    @staticmethod
    def _statistical_forecast(df, days_ahead: int, today: Optional[date] = None) -> List[PredictionItem]:
        """Dự báo thống kê từ các số đo của trạm (DataFrame theo recorded_at), cho các ngày sau hôm nay giờ VN."""
        daily = df["salinity"].dropna()
        daily = daily.groupby(daily.index.tz_convert(TIMEZONE).date).max()
        return statistical_forecast(daily, days_ahead, today or datetime.now(TIMEZONE).date())


def statistical_forecast(daily, days_ahead: int, today: date) -> List[PredictionItem]:
    """
    Giữ nguyên số đo mới nhất (persistence), khoảng tin cậy rộng dần theo độ dao động ngày-qua-ngày của 14 ngày cuối.
    Backtest (app/evaluation/accuracy.py, 360 ngày, chia đôi để chọn và kiểm tra) cho thấy kéo dài xu hướng gần đây
    (v1.1: trung bình 3 ngày + độ dốc 14 ngày tắt dần) sai nhiều hơn cách này ở mọi số ngày dự báo trước:
    độ mặn theo ngày lên xuống liên tục nên xu hướng vài ngày thường đổi chiều. Mô hình mới phải thắng được mức này.

    daily: Series độ mặn cao nhất theo ngày (index là date, tăng dần). Backtest gọi trực tiếp hàm này
    với chuỗi cắt tới một ngày trong quá khứ, nên đánh giá đúng công thức đang chạy thật.
    """
    import math
    import numpy as np

    if len(daily) < MIN_STATISTICAL_DAYS:
        raise InsufficientDataError(f"Trạm chỉ có {len(daily)} ngày số đo độ mặn gần đây, chưa đủ để dự báo")

    level = float(daily.iloc[-1])
    changes = np.diff(daily.tail(14).values)
    step_spread = max(float(np.std(changes)) if len(changes) > 1 else 0.0, level * 0.05, 0.05)

    last_day = daily.index[-1]
    predictions = []
    for i in range(1, days_ahead + 1):
        forecast_date = today + timedelta(days=i)
        steps = (forecast_date - last_day).days
        # Thay đổi ngẫu nhiên cộng dồn qua từng ngày: sai số lớn dần theo căn bậc hai số ngày
        uncertainty = step_spread * math.sqrt(steps)
        predictions.append(PredictionItem(
            date=forecast_date,
            salinity=round(level, 2),
            confidence=round(max(0.5, 0.95 - 0.03 * steps), 2),
            lower_bound=round(max(0.0, level - 1.96 * uncertainty), 2),
            upper_bound=round(level + 1.96 * uncertainty, 2),
            model_version=STATISTICAL_VERSION,
        ))
    return predictions


# Singleton
predictor = Predictor()
