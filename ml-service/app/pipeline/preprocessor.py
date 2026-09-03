import pandas as pd
import logging
from typing import List, Dict
from sklearn.preprocessing import MinMaxScaler
import numpy as np

logger = logging.getLogger(__name__)

class DataPreprocessor:
    """
    Cleans and preprocesses raw hydrology data for ML modeling and DB storage.
    """
    def __init__(self):
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        
    def process(self, raw_data: List[Dict]) -> pd.DataFrame:
        """
        Executes the preprocessing pipeline:
        1. Convert to DataFrame
        2. Missing values interpolation
        3. Resampling to 1H
        4. Min-Max Scaling
        """
        if not raw_data:
            return pd.DataFrame()
            
        df = pd.DataFrame(raw_data)
        
        # Convert timestamp strings to datetime objects
        df['recorded_at'] = pd.to_datetime(df['recorded_at'])
        
        processed_dfs = []
        
        # Process each station separately because time-series interpolation 
        # and resampling must be done per-station
        for station_code, group in df.groupby('station_code'):
            # Set index for time-series operations
            station_df = group.set_index('recorded_at').sort_index()
            
            # 1. Resample to 1H (this will create NaNs for missing hours)
            # We select only numeric columns for resampling
            numeric_cols = ['salinity', 'water_level', 'flow_rate']
            resampled = station_df[numeric_cols].resample('1h').mean()
            
            # 2. Linear Time-series Interpolation to fill missing values
            interpolated = resampled.interpolate(method='time')
            
            # Forward fill then backward fill to catch edge NaNs
            cleaned = interpolated.ffill().bfill()
            
            # 3. Min-Max Scaling [0,1]
            if len(cleaned) > 0:
                scaled_values = self.scaler.fit_transform(cleaned)
                scaled_df = pd.DataFrame(
                    scaled_values, 
                    columns=numeric_cols, 
                    index=cleaned.index
                )
            else:
                scaled_df = cleaned
                
            # Add back station code
            scaled_df['station_code'] = station_code
            processed_dfs.append(scaled_df.reset_index())
            
        if not processed_dfs:
            return pd.DataFrame()
            
        final_df = pd.concat(processed_dfs, ignore_index=True)
        logger.info(f"Preprocessing complete. Yielded {len(final_df)} clean records.")
        return final_df
