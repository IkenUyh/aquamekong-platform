import logging
import os
from datetime import date, timedelta
from typing import List

import numpy as np
import pandas as pd
import torch
from statsmodels.tsa.arima.model import ARIMA

from app.config import get_settings
from app.schemas.forecast import PredictionItem
from app.pipeline.dataset_loader import DataLoaderService
from app.models.hybrid_arima_cnn import ResidualCNN

logger = logging.getLogger(__name__)
settings = get_settings()


class HybridSalinityModel:
    """
    Hybrid (ARIMA + CNN) based salinity forecasting model.
    """

    def __init__(self):
        self.model_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'trained_models')
        self.model_path = os.path.join(self.model_dir, "hybrid_cnn.pth")
        
        # We need the dataloader to get the historical context and scaler
        self.loader_service = DataLoaderService(lookback=14, horizon=1)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.cnn_model = None

    def has_trained_model(self, station_id: int = None) -> bool:
        """Check if the global trained CNN model exists."""
        return os.path.exists(self.model_path)

    def load_model(self):
        """Lazy load the CNN model."""
        if self.cnn_model is None:
            self.cnn_model = ResidualCNN(input_size=2, hidden_channels=32, output_size=1)
            self.cnn_model.load_state_dict(torch.load(self.model_path, map_location=self.device))
            self.cnn_model.to(self.device)
            self.cnn_model.eval()

    def predict(self, station_id: int, days_ahead: int = 7) -> List[PredictionItem]:
        """
        Generate predictions using the Hybrid ARIMA+CNN model.
        
        Args:
            station_id: Station ID.
            days_ahead: Number of days to forecast.
            
        Returns:
            List of PredictionItem.
        """
        if not self.has_trained_model():
            raise FileNotFoundError(f"No trained hybrid model found at {self.model_path}")
            
        self.load_model()
        
        # 1. Load historical data context using DataLoaderService
        # For a real prediction, we need the raw data of this station to scale it
        # and fit the ARIMA baseline.
        df_all = self.loader_service.load_raw_data()
        df_station = df_all[df_all['station_id'] == station_id].copy()
        
        if df_station.empty or len(df_station) < 30:
            raise ValueError(f"Insufficient historical CSV data for station {station_id}")
            
        # We must scale the data using the SAME scaler that was trained on the whole dataset
        # In a real production system, the scaler should be saved as a .pkl file during training.
        # For now, we fit it on df_all to reproduce the exact state as training.
        self.loader_service.scaler.fit(df_all[self.loader_service.feature_cols])
        
        # Scale the station data
        scaled_features = self.loader_service.scaler.transform(df_station[self.loader_service.feature_cols])
        
        # Extract sequences
        wl_series = scaled_features[:, 1]  # water_level_max
        sal_series = scaled_features[:, 3] # salinity_max
        
        # Fit ARIMA to get baseline trend and residuals
        # We suppress warnings to keep logs clean
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            arima_wl = ARIMA(wl_series, order=(1,0,0)).fit()
            arima_sal = ARIMA(sal_series, order=(1,0,0)).fit()
        
        wl_residuals = wl_series - arima_wl.fittedvalues
        sal_residuals = sal_series - arima_sal.fittedvalues
        
        # Prepare the CNN input window (last 14 days)
        lookback = self.loader_service.lookback
        recent_wl_res = wl_residuals[-lookback:]
        recent_sal_res = sal_residuals[-lookback:]
        
        predictions = []
        today = date.today()
        
        # Predict autoregressively for days_ahead
        for i in range(1, days_ahead + 1):
            # 1. ARIMA prediction for day i
            # We forecast 1 step ahead from the ARIMA model
            arima_sal_forecast = arima_sal.forecast(steps=i)[-1]
            
            # 2. CNN prediction for residual
            # Create input tensor shape: (1, 14, 2)
            cnn_input = np.stack([recent_wl_res, recent_sal_res], axis=1)
            cnn_input_tensor = torch.tensor(cnn_input, dtype=torch.float32).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                cnn_res_forecast = self.cnn_model(cnn_input_tensor).item()
                
            # 3. Combine Hybrid Prediction (Scaled)
            final_pred_scaled = arima_sal_forecast + cnn_res_forecast
            
            # 4. Inverse transform to get real salinity value
            dummy_pred = np.zeros((1, 4))
            dummy_pred[0, 3] = final_pred_scaled # salinity_max is index 3
            real_salinity = self.loader_service.scaler.inverse_transform(dummy_pred)[0, 3]
            
            predictions.append(
                PredictionItem(
                    date=today + timedelta(days=i),
                    salinity=round(max(0, float(real_salinity)), 2),
                    confidence=0.90,  # Example confidence
                    lower_bound=round(max(0, float(real_salinity) - 0.2), 2),
                    upper_bound=round(float(real_salinity) + 0.2, 2),
                    model_version="hybrid-arima-cnn-v1.0"
                )
            )
            
            # Autoregressive update: shift window and append the new predicted residual
            # For water level, we assume residual is 0 for future or naive forecast
            recent_wl_res = np.append(recent_wl_res[1:], 0.0) 
            recent_sal_res = np.append(recent_sal_res[1:], cnn_res_forecast)
            
        return predictions
