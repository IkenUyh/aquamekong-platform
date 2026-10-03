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
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1 
    dlon = lon2 - lon1 
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers
    return c * r

class STGNNDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

class DataLoaderService:
    def __init__(self, data_dir=None, lookback=14, horizon=1, max_missing_ratio=0.20):
        """
        Args:
            data_dir: Path to raw data folder.
            lookback: Number of past days to use as input features.
            horizon: The number of days ahead to predict.
            max_missing_ratio: Maximum allowed missing data ratio for a station to be kept.
        """
        self.data_dir = data_dir or settings.raw_data_dir
        self.lookback = lookback
        self.horizon = horizon
        self.max_missing_ratio = max_missing_ratio
        self.scaler = MinMaxScaler()
        self.feature_cols = [
            'distance_to_river_mouth_km',
            'salinity_max_lag_1d', 
            'salinity_max_delta_3d',
            'water_level_max_lag_1d', 
            'water_level_max_roll7d_std',
            'upstream_discharge_lag_1d', 
            'rainfall_mm_roll7d_sum',
            'tpxo_tide_mean_cm_lag_1d',
            'tpxo_tide_range_cm_lag_1d',
            'day_of_year_sin', 
            'day_of_year_cos',
            'salinity_max'
        ]
        self.target_col = 'salinity_max'

    def load_raw_data(self):
        """
        Scan the data directory for the 5-year Rynan CSV file or metadata file,
        filter out bad stations, pivot it, and compute the distance matrix W_D.
        """
        # Ưu tiên tìm file AquaMekong_CLEAN_FEATURES_FINAL.csv
        all_files = glob.glob(os.path.join(self.data_dir, "**", "AquaMekong_CLEAN_FEATURES_FINAL.csv"), recursive=True)
        if not all_files:
            all_files = glob.glob(os.path.join(self.data_dir, "**", "Rynan_*.csv"), recursive=True)
        if not all_files:
            all_files = glob.glob(os.path.join(self.data_dir, "**", "*with_metadata*.csv"), recursive=True)
            
        file_path = all_files[0]
        
        print(f"Loading data from: {file_path}")
        df = pd.read_csv(file_path)
        df['date'] = pd.to_datetime(df['date'])
        
        # 1. LỌC TRẠM (STATION FILTERING)
        # Tính tỷ lệ khuyết của cột mục tiêu (salinity_max) theo từng trạm
        missing_ratios = df.groupby('station_id')[self.target_col].apply(lambda x: x.isna().sum() / len(x))
        # Tăng tỷ lệ lên 50% để cứu vớt các trạm hỏng nhẹ bằng Nội suy Không gian (IDW)
        self.max_missing_ratio = 0.50
        valid_stations = missing_ratios[missing_ratios <= self.max_missing_ratio].index.tolist()
        
        print(f"BỘ LỌC TRẠM: Giữ lại {len(valid_stations)}/{len(missing_ratios)} trạm (Áp dụng IDW cứu dữ liệu)")
        
        # Chỉ giữ lại dữ liệu của các trạm hợp lệ
        df = df[df['station_id'].isin(valid_stations)].copy()
        
        stations = sorted(df['station_id'].unique())
        self.stations = stations
        num_stations = len(stations)
        
        # 2. TÍNH MA TRẬN KHOẢNG CÁCH (W_D)
        W_D = np.zeros((num_stations, num_stations))
        
        if 'latitude' in df.columns and 'longitude' in df.columns:
            station_coords = {}
            for st in stations:
                st_data = df[df['station_id'] == st].iloc[0]
                station_coords[st] = (st_data['latitude'], st_data['longitude'])
            
            sigma = 10.0 
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
            W_D = np.eye(num_stations)
            
        # 3. PIVOT VÀ NỘI SUY KHÔNG GIAN (SPATIAL IMPUTATION - IDW)
        pivot_df = df.pivot(index='date', columns='station_id', values=self.feature_cols)
        
        # Ma trận W_D không chứa đường chéo (chỉ dùng hàng xóm)
        W_D_neighbors = W_D.copy()
        np.fill_diagonal(W_D_neighbors, 0)
        
        # Áp dụng IDW cho từng feature
        for feat in self.feature_cols:
            X_feat = pivot_df[feat].values
            mask = ~np.isnan(X_feat)
            
            # Tính nội suy: Giá trị hàng xóm có trọng số / Tổng trọng số
            X_imputed = (np.nan_to_num(X_feat) @ W_D_neighbors) / (mask @ W_D_neighbors + 1e-8)
            
            # Vá các chỗ khuyết bằng giá trị nội suy (Nếu tất cả hàng xóm đều khuyết thì giữ nguyên NaN)
            X_feat_final = np.where(mask, X_feat, X_imputed)
            X_feat_final[X_feat_final == 0] = np.nan # Re-apply NaN for empty spots
            pivot_df[feat] = X_feat_final
        
        # 4. NỘI SUY THỜI GIAN (TIME INTERPOLATION)
        # Dùng nội suy tuyến tính (Linear) để lấp các lỗ hổng còn sót lại
        pivot_df = pivot_df.interpolate(method='time', limit=5, limit_direction='both')
        # Bù các lỗ hổng lớn còn lại bằng ffill/bfill
        pivot_df = pivot_df.ffill().bfill().fillna(0)
        
        self.W_D = W_D
        return pivot_df, num_stations

    def prepare_data(self, test_size=0.2):
        pivot_df, num_stations = self.load_raw_data()
        
        num_dates = len(pivot_df)
        num_features = len(self.feature_cols)
        
        feature_arrays = []
        for feat in self.feature_cols:
            feat_data = pivot_df[feat][self.stations].values 
            feature_arrays.append(feat_data)
            
        X_raw = np.stack(feature_arrays, axis=-1)
        
        X_flat = X_raw.reshape(-1, num_features)
        X_scaled_flat = self.scaler.fit_transform(X_flat)
        X_scaled = X_scaled_flat.reshape(num_dates, num_stations, num_features)
        
        X_all, y_all = [], []
        target_idx = self.feature_cols.index(self.target_col)
        
        for i in range(num_dates - self.lookback - self.horizon + 1):
            X_window = X_scaled[i : i + self.lookback, :, :]
            X_window = np.transpose(X_window, (1, 0, 2))
            
            y_value = X_scaled[i + self.lookback + self.horizon - 1, :, target_idx]
            
            X_all.append(X_window)
            y_all.append(y_value)
            
        X_all = np.array(X_all) 
        y_all = np.array(y_all) 
        
        split_idx = int(len(X_all) * (1 - test_size))
        
        X_train, y_train = X_all[:split_idx], y_all[:split_idx]
        X_test, y_test = X_all[split_idx:], y_all[split_idx:]
        
        train_dataset = STGNNDataset(X_train, y_train)
        test_dataset = STGNNDataset(X_test, y_test)
        
        train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
        test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
        
        return train_loader, test_loader, self.scaler, self.W_D, num_stations
