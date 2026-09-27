"""
Predictor service — Runs inference using trained models or generates
simulated predictions when no model is available.
"""

import logging
from datetime import date, timedelta
from typing import List
from app.schemas.forecast import PredictionItem
from app.services.data_loader import load_station_metrics, load_station_info
from app.models.hybrid_salinity_model import HybridSalinityModel

logger = logging.getLogger(__name__)


class Predictor:
    """Prediction pipeline for salinity forecasting."""

    def __init__(self):
        self.model = HybridSalinityModel()

    def predict(self, station_id, days_ahead: int = 7) -> List[PredictionItem]:
        """
        Generate salinity predictions for a station.
        """
        try:
            # Try trained model first (Bypass PostgreSQL if model is ready)
            if self.model.has_trained_model(station_id):
                logger.info(f"Using trained model for station {station_id}")
                return self.model.predict(station_id, days_ahead)

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
