import os
import glob
import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import MinMaxScaler
from torch.utils.data import Dataset, DataLoader
from app.config import get_settings

settings = get_settings()

class MekongDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

class DataLoaderService:
    def __init__(self, data_dir=None, lookback=14, horizon=7):
        """
        Args:
            data_dir: Path to raw data folder.
            lookback: Number of past days to use as input features.
            horizon: The number of days ahead to predict (e.g. 7 means we predict the value 7 days from now).
        """
        self.data_dir = data_dir or settings.raw_data_dir
        self.lookback = lookback
        self.horizon = horizon
        self.scaler = MinMaxScaler()
        # Features we use for training
        self.feature_cols = ['water_level_min', 'water_level_max', 'salinity_min', 'salinity_max']
        self.target_col = 'salinity_max'

    def load_raw_data(self) -> pd.DataFrame:
        """
        Scan the data directory for all RAW_DATA_*.csv files and combine them.
        """
        all_files = glob.glob(os.path.join(self.data_dir, "**", "RAW_DATA_*.csv"), recursive=True)
        if not all_files:
            raise FileNotFoundError(f"No CSV data found in {self.data_dir}")
        
        df_list = []
        for file in all_files:
            try:
                df = pd.read_csv(file)
                df_list.append(df)
            except Exception as e:
                print(f"Error reading {file}: {e}")
                
        full_df = pd.concat(df_list, ignore_index=True)
        # Convert date
        full_df['date'] = pd.to_datetime(full_df['date'])
        # Sort by station and date
        full_df = full_df.sort_values(by=['station_id', 'date']).reset_index(drop=True)
        
        # Fill missing values using forward fill then backward fill per station
        full_df[self.feature_cols] = full_df.groupby('station_id')[self.feature_cols].transform(lambda x: x.ffill().bfill())
        # Any remaining NaNs (if a station is completely empty) will be filled with 0
        full_df[self.feature_cols] = full_df[self.feature_cols].fillna(0)
        
        return full_df

    def prepare_data(self, test_size=0.2):
        """
        Prepare sliding windows for train and test sets.
        Returns:
            train_loader, test_loader, scaler
        """
        df = self.load_raw_data()
        
        # Scale the features
        # We fit the scaler on the whole dataset for simplicity in this baseline,
        # but in production, we should fit only on the train set.
        df[self.feature_cols] = self.scaler.fit_transform(df[self.feature_cols])
        
        X_all, y_all = [], []
        
        # We must create windows per station to avoid mixing data from different stations
        for station_id, group in df.groupby('station_id'):
            group = group.sort_values('date').reset_index(drop=True)
            values = group[self.feature_cols].values
            target_idx = self.feature_cols.index(self.target_col)
            
            # Create sliding windows
            for i in range(len(values) - self.lookback - self.horizon + 1):
                X_window = values[i : i + self.lookback]
                # Predict the target `horizon` days ahead
                # e.g. horizon=1 means next day. horizon=7 means the 7th day after the window
                y_value = values[i + self.lookback + self.horizon - 1, target_idx]
                X_all.append(X_window)
                y_all.append(y_value)
                
        X_all = np.array(X_all)
        y_all = np.array(y_all).reshape(-1, 1)
        
        # Split train/test (Temporal split or random split? Let's use simple random split for baseline, 
        # or temporal split by just taking the last 20% of the windows)
        split_idx = int(len(X_all) * (1 - test_size))
        
        X_train, y_train = X_all[:split_idx], y_all[:split_idx]
        X_test, y_test = X_all[split_idx:], y_all[split_idx:]
        
        train_dataset = MekongDataset(X_train, y_train)
        test_dataset = MekongDataset(X_test, y_test)
        
        train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
        test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
        
        return train_loader, test_loader, self.scaler
