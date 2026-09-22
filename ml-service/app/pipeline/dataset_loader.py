import os
import glob
import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import MinMaxScaler
from torch.utils.data import Dataset, DataLoader
from app.config import get_settings

settings = get_settings()

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance in kilometers between two points on the earth."""
    # Convert latitude and longitude to radians
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1 
    dlon = lon2 - lon1 
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers
    return c * r

class STGNNDataset(Dataset):
    def __init__(self, X, y):
        # X shape: (Batch, N_stations, Lookback, N_features)
        self.X = torch.tensor(X, dtype=torch.float32)
        # y shape: (Batch, N_stations)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

class DataLoaderService:
    def __init__(self, data_dir=None, lookback=14, horizon=1):
        """
        Args:
            data_dir: Path to raw data folder.
            lookback: Number of past days to use as input features.
            horizon: The number of days ahead to predict (1 means next day).
        """
        self.data_dir = data_dir or settings.raw_data_dir
        self.lookback = lookback
        self.horizon = horizon
        self.scaler = MinMaxScaler()
        self.feature_cols = ['water_level_min', 'water_level_max', 'salinity_min', 'salinity_max']
        self.target_col = 'salinity_max'

    def load_raw_data(self):
        """
        Scan the data directory for the metadata CSV file, pivot it for ST-GNN,
        and compute the distance matrix W_D.
        """
        all_files = glob.glob(os.path.join(self.data_dir, "**", "*with_metadata*.csv"), recursive=True)
        if not all_files:
            # Fallback if the specific metadata file is not found
            all_files = glob.glob(os.path.join(self.data_dir, "**", "*.csv"), recursive=True)
            if not all_files:
                raise FileNotFoundError(f"No CSV data found in {self.data_dir}")
        
        # We use the newest file assuming it's the metadata one
        all_files.sort(key=os.path.getmtime, reverse=True)
        file_path = all_files[0]
        
        print(f"Loading data from: {file_path}")
        df = pd.read_csv(file_path)
        df['date'] = pd.to_datetime(df['date'])
        
        # Get unique stations and sort them to maintain a consistent order
        stations = sorted(df['station_id'].unique())
        self.stations = stations
        num_stations = len(stations)
        
        # Compute W_D (Physical Distance Adjacency Matrix)
        W_D = np.zeros((num_stations, num_stations))
        
        # Check if latitude and longitude exist
        if 'latitude' in df.columns and 'longitude' in df.columns:
            # Get coordinates for each station (take the first occurrence)
            station_coords = {}
            for st in stations:
                st_data = df[df['station_id'] == st].iloc[0]
                station_coords[st] = (st_data['latitude'], st_data['longitude'])
            
            # Compute distance matrix and apply Gaussian kernel
            sigma = 10.0 # 10 km standard deviation for kernel
            for i, st1 in enumerate(stations):
                for j, st2 in enumerate(stations):
                    if i == j:
                        W_D[i, j] = 1.0
                    else:
                        dist = haversine_distance(
                            station_coords[st1][0], station_coords[st1][1],
                            station_coords[st2][0], station_coords[st2][1]
                        )
                        W_D[i, j] = np.exp(-(dist**2) / (sigma**2))
        else:
            print("Warning: latitude and longitude not found. Using Identity matrix for W_D.")
            W_D = np.eye(num_stations)
            
        # Pivot the dataframe so that index is date, columns are MultiIndex (station_id, feature)
        pivot_df = df.pivot(index='date', columns='station_id', values=self.feature_cols)
        
        # Fill missing values using forward fill then backward fill
        pivot_df = pivot_df.ffill().bfill().fillna(0)
        
        self.W_D = W_D
        return pivot_df, num_stations

    def prepare_data(self, test_size=0.2):
        """
        Prepare sliding windows for ST-GNN.
        Returns:
            train_loader, test_loader, scaler, W_D, num_stations
        """
        pivot_df, num_stations = self.load_raw_data()
        
        num_dates = len(pivot_df)
        num_features = len(self.feature_cols)
        
        # Extract arrays per feature
        feature_arrays = []
        for feat in self.feature_cols:
            # Shape: (num_dates, num_stations)
            feat_data = pivot_df[feat][self.stations].values 
            feature_arrays.append(feat_data)
            
        # Stack to shape (num_dates, num_stations, num_features)
        X_raw = np.stack(feature_arrays, axis=-1)
        
        # Scale
        X_flat = X_raw.reshape(-1, num_features)
        X_scaled_flat = self.scaler.fit_transform(X_flat)
        X_scaled = X_scaled_flat.reshape(num_dates, num_stations, num_features)
        
        X_all, y_all = [], []
        target_idx = self.feature_cols.index(self.target_col)
        
        # Create sliding windows
        for i in range(num_dates - self.lookback - self.horizon + 1):
            # Window shape: (lookback, N, F)
            X_window = X_scaled[i : i + self.lookback, :, :]
            # ST-GNN usually expects (N, Lookback, F)
            X_window = np.transpose(X_window, (1, 0, 2))
            
            # Target shape: (N,)
            y_value = X_scaled[i + self.lookback + self.horizon - 1, :, target_idx]
            
            X_all.append(X_window)
            y_all.append(y_value)
            
        X_all = np.array(X_all) # Shape: (Batch, N, Lookback, F)
        y_all = np.array(y_all) # Shape: (Batch, N)
        
        split_idx = int(len(X_all) * (1 - test_size))
        
        X_train, y_train = X_all[:split_idx], y_all[:split_idx]
        X_test, y_test = X_all[split_idx:], y_all[split_idx:]
        
        train_dataset = STGNNDataset(X_train, y_train)
        test_dataset = STGNNDataset(X_test, y_test)
        
        train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
        test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
        
        return train_loader, test_loader, self.scaler, self.W_D, num_stations
