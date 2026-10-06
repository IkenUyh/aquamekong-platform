"""
Predictor service — Runs inference using trained models or generates
simulated predictions when no model is available.
"""

import json
import logging
from datetime import date, timedelta
from typing import List, Optional
from app.cache import get_redis
from app.config import get_settings
from app.schemas.forecast import PredictionItem
from app.services.data_loader import load_station_metrics, load_station_info
from app.models.hybrid_salinity_model import HybridSalinityModel
from app.models.salinity_model import SalinityModel
from app.stgnn.forecaster import forecaster as stgnn_forecaster

logger = logging.getLogger(__name__)


class Predictor:
    """Prediction pipeline for salinity forecasting."""

    def __init__(self):
        self.model = HybridSalinityModel()
        # Model Prophet riêng từng trạm, được train qua POST /api/v1/train
        self.prophet = SalinityModel()

    @staticmethod
    def _cache_key(station_id, days_ahead: int) -> str:
        # Gắn ngày hiện tại vào key để dự báo tự làm mới khi sang ngày mới
        return f"forecast:{station_id}:{days_ahead}:{date.today().isoformat()}"

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
        if predictions and predictions[0].model_version != "simulated-v1.0":
            self._set_cached(key, predictions)
        return predictions

    def _predict_uncached(self, station_id, days_ahead: int) -> List[PredictionItem]:
        """
        Thứ tự: ST-GNN (trạm có trong model và tốt hơn giữ nguyên giá trị cũ) -> Prophet riêng của trạm
        -> Hybrid ARIMA-CNN (global) -> thống kê -> mô phỏng.
        Mỗi tầng lỗi thì rơi xuống tầng sau, không làm hỏng cả request.
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

        try:
            # Try to load historical data for statistical fallback
            df = load_station_metrics(station_id, lookback_days=90)
            station_info = load_station_info(station_id)

            if df.empty or len(df) < 3:
                logger.warning(
                    f"Insufficient data for station {station_id}, using simulation"
                )
                return self._simulate_predictions(station_id, days_ahead)

            # Fallback: statistical estimation based on recent trends
            logger.info(
                f"No trained model for station {station_id}, using statistical estimation"
            )
            return self._statistical_forecast(df, days_ahead)

        except Exception as e:
            logger.error(f"Prediction failed for station {station_id}: {e}")
            return self._simulate_predictions(station_id, days_ahead)

    def _stgnn_forecast(self, station_id, days_ahead: int) -> Optional[List[PredictionItem]]:
        try:
            code = load_station_info(station_id)["code"]
            graph = stgnn_forecaster.forecast(code, days_ahead)
            if graph is None:
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

    def _statistical_forecast(
        self, df, days_ahead: int
    ) -> List[PredictionItem]:
        """
        Simple statistical forecast using rolling mean and trend.
        Used when no ML model is trained yet.
        """
        import numpy as np

        salinity = df["salinity"].dropna()

        if salinity.empty:
            return []

        # Calculate statistics
        recent_mean = salinity.tail(10).mean()
        recent_std = salinity.tail(10).std()
        if np.isnan(recent_std) or recent_std == 0:
            recent_std = recent_mean * 0.1  # 10% of mean as default std

        # Simple linear trend
        if len(salinity) > 1:
            x = np.arange(len(salinity))
            coeffs = np.polyfit(x, salinity.values, 1)
            trend_per_day = coeffs[0]
        else:
            trend_per_day = 0

        predictions = []
        today = date.today()

        for i in range(1, days_ahead + 1):
            forecast_date = today + timedelta(days=i)
            predicted = recent_mean + trend_per_day * i

            # Add increasing uncertainty
            uncertainty = recent_std * (1 + 0.1 * i)
            confidence = max(0.5, 0.95 - 0.03 * i)

            predictions.append(
                PredictionItem(
                    date=forecast_date,
                    salinity=round(max(0, predicted), 2),
                    confidence=round(confidence, 2),
                    lower_bound=round(max(0, predicted - 1.96 * uncertainty), 2),
                    upper_bound=round(predicted + 1.96 * uncertainty, 2),
                    model_version="statistical-v1.0",
                )
            )

        return predictions

    def _simulate_predictions(
        self, station_id: int, days_ahead: int
    ) -> List[PredictionItem]:
        """
        Generate simulated predictions for demo purposes.
        Based on typical salinity patterns for each station.
        """
        import numpy as np

        # Base salinity levels per station (matching seed data)
        base_salinity = {
            1: 0.35,   # Cần Thơ
            2: 2.5,    # Mỹ Tho
            3: 5.7,    # Bến Tre
            4: 3.8,    # Trà Vinh
            5: 5.1,    # Sóc Trăng
            6: 9.0,    # Cà Mau
        }

        base = base_salinity.get(station_id, 3.0)
        predictions = []
        today = date.today()

        np.random.seed(station_id * 100)  # Reproducible

        for i in range(1, days_ahead + 1):
            noise = np.random.normal(0, base * 0.08)
            trend = 0.05 * i  # Slight upward trend
            predicted = base + noise + trend
            uncertainty = base * 0.12 * (1 + 0.05 * i)
            confidence = max(0.5, 0.92 - 0.02 * i)

            predictions.append(
                PredictionItem(
                    date=today + timedelta(days=i),
                    salinity=round(max(0, predicted), 2),
                    confidence=round(confidence, 2),
                    lower_bound=round(max(0, predicted - 1.96 * uncertainty), 2),
                    upper_bound=round(predicted + 1.96 * uncertainty, 2),
                    model_version="simulated-v1.0",
                )
            )

        return predictions


# Singleton
predictor = Predictor()
