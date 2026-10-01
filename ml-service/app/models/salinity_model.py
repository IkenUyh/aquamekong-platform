"""
Salinity Model — Facebook Prophet-based time-series forecasting model
for predicting salinity levels in Mekong Delta waterways.
"""

import logging
import os
import threading
from datetime import date, timedelta
from pathlib import Path
from typing import List, Optional

import joblib
import pandas as pd

from app.config import get_settings
from app.schemas.forecast import PredictionItem

logger = logging.getLogger(__name__)
settings = get_settings()


class SalinityModel:
    """
    Prophet-based salinity forecasting model.

    Each station has its own trained model, serialized as a .pkl file
    in the trained_models directory.
    """

    def __init__(self):
        self.model_dir = Path(settings.model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        # station_id -> (mtime, model): tránh joblib.load ở mỗi request
        self._cache = {}
        self._lock = threading.Lock()

    def _load(self, station_id: int):
        path = self._model_path(station_id)
        mtime = path.stat().st_mtime
        with self._lock:
            cached = self._cache.get(station_id)
            if cached is None or cached[0] != mtime:
                cached = (mtime, joblib.load(path))
                self._cache[station_id] = cached
            return cached[1]

    def _model_path(self, station_id: int) -> Path:
        return self.model_dir / f"station_{station_id}_prophet.pkl"

    def has_trained_model(self, station_id: int) -> bool:
        """Check if a trained model exists for this station."""
        return self._model_path(station_id).exists()

    def train(self, station_id: int, df: pd.DataFrame) -> dict:
        """
        Train a Prophet model on station salinity data.

        Args:
            station_id: Station ID.
            df: DataFrame with DatetimeIndex and 'salinity' column.

        Returns:
            dict with training metrics.
        """
        try:
            from prophet import Prophet
        except ImportError as e:
            raise RuntimeError("Prophet chưa được cài: pip install prophet") from e

        logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

        # Dữ liệu đo theo giờ -> trung bình theo ngày, khớp với dự báo theo ngày
        index = pd.to_datetime(df.index)
        if index.tz is not None:
            index = index.tz_localize(None)
        daily = pd.Series(pd.to_numeric(df["salinity"], errors="coerce").values, index=index)
        daily = daily.resample("1D").mean().dropna()
        prophet_df = pd.DataFrame({"ds": daily.index, "y": daily.values})

        if len(prophet_df) < 10:
            raise ValueError(f"Need at least 10 days of data, got {len(prophet_df)}")

        model = Prophet(
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
            yearly_seasonality=len(prophet_df) >= 365,
            weekly_seasonality=True,
            daily_seasonality=False,
        )
        model.fit(prophet_df)

        model_path = self._model_path(station_id)
        joblib.dump(model, model_path)

        # Training metrics (in-sample)
        from sklearn.metrics import mean_absolute_error, mean_squared_error
        import numpy as np

        predictions = model.predict(prophet_df[["ds"]])
        mae = mean_absolute_error(prophet_df["y"], predictions["yhat"])
        rmse = np.sqrt(mean_squared_error(prophet_df["y"], predictions["yhat"]))

        logger.info(f"Model trained for station {station_id}: MAE={mae:.4f}, RMSE={rmse:.4f}")
        return {
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "data_points": len(prophet_df),
            "model_path": str(model_path),
        }

    def predict(self, station_id: int, days_ahead: int = 7) -> List[PredictionItem]:
        """
        Generate predictions using a trained Prophet model.

        Args:
            station_id: Station ID.
            days_ahead: Number of days to forecast.

        Returns:
            List of PredictionItem.
        """
        model_path = self._model_path(station_id)

        if not model_path.exists():
            raise FileNotFoundError(f"No trained model for station {station_id}")

        model = self._load(station_id)

        # Luôn dự báo từ ngày mai, kể cả khi dữ liệu train đã cũ
        today = date.today()
        future = pd.DataFrame({"ds": pd.to_datetime([today + timedelta(days=i) for i in range(1, days_ahead + 1)])})
        future_forecast = model.predict(future)

        predictions = []
        for _, row in future_forecast.iterrows():
            predictions.append(
                PredictionItem(
                    date=row["ds"].date(),
                    salinity=round(max(0, row["yhat"]), 2),
                    confidence=round(min(1.0, max(0.0,
                        1.0 - (row["yhat_upper"] - row["yhat_lower"]) / (2 * max(row["yhat"], 0.1)),
                    )), 2),
                    lower_bound=round(max(0, row["yhat_lower"]), 2),
                    upper_bound=round(row["yhat_upper"], 2),
                    model_version="prophet-v1.0",
                )
            )

        return predictions
