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
from app.services.data_loader import load_station_metrics, load_station_info
from app.models.hybrid_salinity_model import HybridSalinityModel
from app.models.salinity_model import SalinityModel
from app.stgnn.forecaster import forecaster as stgnn_forecaster

logger = logging.getLogger(__name__)

TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
# Dự báo thống kê cần ít nhất ngần này ngày có số đo trong khoảng lookback
MIN_STATISTICAL_DAYS = 3
# Độ dốc yếu đi mỗi ngày (damped trend): xu hướng gần đây không bị kéo thẳng tới 0 hay tăng mãi
TREND_DAMPING = 0.8


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
        # Gắn ngày hiện tại (giờ VN) vào key để dự báo tự làm mới khi sang ngày mới
        return f"forecast:{station_id}:{days_ahead}:{datetime.now(TIMEZONE).date().isoformat()}"

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
        key = self._cache_key(station_id, days_ahead)
        cached = self._get_cached(key)
        if cached is not None:
            logger.info(f"Forecast cache hit for station {station_id}")
            return cached

        predictions = self._predict_uncached(station_id, days_ahead)
        if predictions:
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
        """
        Xu hướng ngắn hạn tắt dần: mức hiện tại (trung bình 3 ngày cuối) cộng độ dốc của 14 ngày cuối
        (tính theo ngày thật, có chỗ trống vẫn đúng) nhân hệ số giảm dần, cho các ngày sau hôm nay giờ VN.
        """
        import numpy as np

        daily = df["salinity"].dropna()
        daily = daily.groupby(daily.index.tz_convert(TIMEZONE).date).max()
        if len(daily) < MIN_STATISTICAL_DAYS:
            raise InsufficientDataError(f"Trạm chỉ có {len(daily)} ngày số đo độ mặn gần đây, chưa đủ để dự báo")

        recent = daily.tail(14)
        offsets = np.array([(d - recent.index[-1]).days for d in recent.index], dtype=float)
        slope = np.polyfit(offsets, recent.values, 1)[0] if len(recent) >= 3 else 0.0
        level = float(daily.tail(3).mean())
        spread = float(recent.std()) if len(recent) > 1 else 0.0
        spread = spread if spread > 0 else max(level * 0.1, 0.05)

        today = today or datetime.now(TIMEZONE).date()
        last_day = daily.index[-1]
        predictions = []
        for i in range(1, days_ahead + 1):
            forecast_date = today + timedelta(days=i)
            steps = (forecast_date - last_day).days
            damped_steps = sum(TREND_DAMPING ** k for k in range(1, steps + 1))
            predicted = max(0.0, level + slope * damped_steps)
            uncertainty = spread * (1 + 0.1 * steps)
            predictions.append(PredictionItem(
                date=forecast_date,
                salinity=round(predicted, 2),
                confidence=round(max(0.5, 0.95 - 0.03 * steps), 2),
                lower_bound=round(max(0.0, predicted - 1.96 * uncertainty), 2),
                upper_bound=round(predicted + 1.96 * uncertainty, 2),
                model_version="statistical-v1.1",
            ))
        return predictions


# Singleton
predictor = Predictor()
