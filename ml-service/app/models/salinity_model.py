"""
Salinity Model — Facebook Prophet-based time-series forecasting model
for predicting salinity levels in Mekong Delta waterways.
"""

import logging
import os
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

            # Prepare data for Prophet (requires 'ds' and 'y' columns)
            prophet_df = pd.DataFrame({
                "ds": df.index,
                "y": df["salinity"].values,
            }).dropna()

            if len(prophet_df) < 10:
                raise ValueError(
                    f"Need at least 10 data points, got {len(prophet_df)}"
                )

            # Configure and train model
            model = Prophet(
                changepoint_prior_scale=0.05,
                seasonality_prior_scale=10,
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
            )

            # Suppress Prophet logs
            model.fit(prophet_df, suppress_logging=True if hasattr(Prophet, 'suppress_logging') else False)

            # Save model
            model_path = self._model_path(station_id)
            joblib.dump(model, model_path)

            # Calculate training metrics
            predictions = model.predict(prophet_df[["ds"]])
            from sklearn.metrics import mean_absolute_error, mean_squared_error
            import numpy as np

            mae = mean_absolute_error(prophet_df["y"], predictions["yhat"])
            rmse = np.sqrt(mean_squared_error(prophet_df["y"], predictions["yhat"]))

            metrics = {
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
                "data_points": len(prophet_df),
                "model_path": str(model_path),
            }

            logger.info(f"Model trained for station {station_id}: MAE={mae:.4f}, RMSE={rmse:.4f}")
            return metrics

        except ImportError:
            logger.error("Prophet not installed. Install with: pip install prophet")
            return {"error": "Prophet not available", "status": "failed"}

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

        model = joblib.load(model_path)

        # Create future dataframe
        future = model.make_future_dataframe(periods=days_ahead)
        forecast = model.predict(future)

        # Extract only future predictions
        today = pd.Timestamp(date.today())
        future_forecast = forecast[forecast["ds"] > today].tail(days_ahead)

        predictions = []
        for _, row in future_forecast.iterrows():
            predictions.append(
                PredictionItem(
                    date=row["ds"].date(),
                    salinity=round(max(0, row["yhat"]), 2),
                    confidence=round(
                        1.0 - (row["yhat_upper"] - row["yhat_lower"]) / (2 * max(row["yhat"], 0.1)),
                        2,
                    ),
                    lower_bound=round(max(0, row["yhat_lower"]), 2),
                    upper_bound=round(row["yhat_upper"], 2),
                    model_version="prophet-v1.0",
                )
            )

        return predictions
