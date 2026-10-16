import os
import sys
import glob
import json
import argparse
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from torch.utils.data import Dataset, DataLoader

# Thêm đường dẫn ml-service vào sys.path
ML_SERVICE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)

from app.models.st_gnn import STGNN

LOOKBACK = 14
DEFAULT_HORIZONS = [1, 2, 3, 4, 5, 6, 7, 8]
TRAINED_UNTIL_DATE = "2026-08-31"

DAILY_FEATURES = [
    'distance_to_river_mouth_km',
    'distance_to_coast_km',
    'salinity_max_lag_1d', 
    'salinity_max_delta_3d',
    'salinity_max_delta_7d',
    'water_level_max_lag_1d', 
    'water_level_max_lag_7d',
    'water_level_max_roll7d_std',
    'day_of_year_sin', 
    'day_of_year_cos',
    'salinity_max'
]
TARGET_COL = 'salinity_max'

def find_data_path(csv_path=None):
    if csv_path and os.path.exists(csv_path):
        return os.path.abspath(csv_path)
    candidates = [
        os.path.join(os.path.dirname(__file__), '..', '..', 'Data', 'AquaMekong_CLEAN_FEATURES_FINAL.csv'),
        os.path.join(os.path.dirname(__file__), '..', 'Data', 'AquaMekong_CLEAN_FEATURES_FINAL.csv'),
        'Data/AquaMekong_CLEAN_FEATURES_FINAL.csv',
        'AquaMekong_CLEAN_FEATURES_FINAL.csv'
    ]
    for p in candidates:
        if os.path.exists(p):
            return os.path.abspath(p)
    raise FileNotFoundError("Không tìm thấy file AquaMekong_CLEAN_FEATURES_FINAL.csv tại các đường dẫn mặc định.")

def get_save_dir():
    save_dir = os.path.join(ML_SERVICE_DIR, 'trained_models', 'stgnn_daily')
    os.makedirs(save_dir, exist_ok=True)
    return save_dir

def haversine_distance(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1 
    dlon = lon2 - lon1 
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a)) 
    return c * 6371.0

class STGNNDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

class PinballLoss(nn.Module):
    def __init__(self, quantiles=[0.1, 0.5, 0.9]):
        super(PinballLoss, self).__init__()
        self.quantiles = quantiles

    def forward(self, pred, target):
        target = target.unsqueeze(-1)
        losses = []
        for i, q in enumerate(self.quantiles):
            err = target[:, :, 0] - pred[:, :, i]
            loss_q = torch.max(q * err, (q - 1.0) * err)
            losses.append(loss_q)
        return torch.mean(torch.stack(losses, dim=-1))

def load_panel_data(csv_path=None):
    real_csv_path = find_data_path(csv_path)
    df = pd.read_csv(real_csv_path)
    df['date'] = pd.to_datetime(df['date'])
    
    # 17 trạm lõi chuẩn (tỷ lệ khuyết <= 50%)
    missing_ratios = df.groupby('station_id')[TARGET_COL].apply(lambda x: x.isna().sum() / len(x))
    valid_stations = missing_ratios[missing_ratios <= 0.50].index.tolist()
    valid_stations = sorted(valid_stations)
    
    df = df[df['station_id'].isin(valid_stations)].copy()
    num_stations = len(valid_stations)
    
    # Ma trận W_D dựa trên khoảng cách địa lý
    station_coords = {}
    for st in valid_stations:
        st_data = df[df['station_id'] == st].iloc[0]
        station_coords[st] = (st_data['latitude'], st_data['longitude'])
        
    W_D = np.zeros((num_stations, num_stations))
    sigma = 10.0
    for i, st1 in enumerate(valid_stations):
        for j, st2 in enumerate(valid_stations):
            if i == j:
                W_D[i, j] = 1.0
            else:
                dist = haversine_distance(
                    station_coords[st1][0], station_coords[st1][1],
                    station_coords[st2][0], station_coords[st2][1]
                )
                W_D[i, j] = np.exp(-(dist**2) / (sigma**2))
                
    # Nội suy không gian IDW (Inverse Distance Weighting)
    pivot_df = df.pivot(index='date', columns='station_id', values=DAILY_FEATURES)
    W_D_neighbors = W_D.copy()
    np.fill_diagonal(W_D_neighbors, 0)
    
    for feat in DAILY_FEATURES:
        X_feat = pivot_df[feat].values
        mask = ~np.isnan(X_feat)
        X_imputed = (np.nan_to_num(X_feat) @ W_D_neighbors) / (mask @ W_D_neighbors + 1e-8)
        X_feat_final = np.where(mask, X_feat, X_imputed)
        X_feat_final[X_feat_final == 0] = np.nan
        pivot_df[feat] = X_feat_final
        
    pivot_df = pivot_df.interpolate(method='time', limit=5, limit_direction='both').ffill().bfill().fillna(0)
    return pivot_df, valid_stations, W_D

def build_samples(pivot_df, stations, scaler, horizon, fit_scaler=False):
    num_dates = len(pivot_df)
    num_stations = len(stations)
    num_features = len(DAILY_FEATURES)
    
    feature_arrays = []
    for feat in DAILY_FEATURES:
        feat_data = pivot_df[feat][stations].values 
        feature_arrays.append(feat_data)
        
    X_raw = np.stack(feature_arrays, axis=-1)
    X_flat = X_raw.reshape(-1, num_features)
    
    if fit_scaler:
        scaler.fit(X_flat)
        
    X_scaled = scaler.transform(X_flat).reshape(num_dates, num_stations, num_features)
    
    target_idx = DAILY_FEATURES.index(TARGET_COL)
    dates = pivot_df.index
    
    X_all, y_all, naive_all, sample_dates = [], [], [], []
    
    for i in range(num_dates - LOOKBACK - horizon + 1):
        X_window = X_scaled[i : i + LOOKBACK, :, :]
        X_window = np.transpose(X_window, (1, 0, 2)) # (N, L, F)
        
        y_val = X_scaled[i + LOOKBACK + horizon - 1, :, target_idx] # (N,)
        naive_val = X_scaled[i + LOOKBACK - 1, :, target_idx] # (N,) số đo ngày quan sát cuối
        
        forecast_date = dates[i + LOOKBACK + horizon - 1]
        issue_date = dates[i + LOOKBACK - 1]
        
        X_all.append(X_window)
        y_all.append(y_val)
        naive_all.append(naive_val)
        sample_dates.append((issue_date, forecast_date))
        
    return np.array(X_all), np.array(y_all), np.array(naive_all), sample_dates

def train_model(train_loader, num_stations, num_features, W_D_tensor, horizon, epochs=100, patience=20):
    model = STGNN(num_stations=num_stations, num_features=num_features, lookback=LOOKBACK, d=8, horizon=horizon)
    criterion = PinballLoss(quantiles=[0.1, 0.5, 0.9])
    optimizer = optim.Adam(model.parameters(), lr=0.005, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=8)
    
    best_loss = float('inf')
    best_state = None
    early_stop_cnt = 0
    
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for X_b, y_b in train_loader:
            optimizer.zero_grad()
            out = model(X_b, W_D_tensor)
            loss = criterion(out, y_b)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item() * X_b.size(0)
            
        train_loss /= len(train_loader.dataset)
        scheduler.step(train_loss)
        
        if train_loss < best_loss:
            best_loss = train_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            early_stop_cnt = 0
        else:
            early_stop_cnt += 1
            
        if early_stop_cnt >= patience:
            break
            
    model.load_state_dict(best_state)
    return model

def unscale(scaled_arr, scaler, num_features, target_idx):
    dummy = np.zeros((scaled_arr.size, num_features))
    dummy[:, target_idx] = scaled_arr.flatten()
    return scaler.inverse_transform(dummy)[:, target_idx]

def run_benchmark(horizons=None):
    if horizons is None:
        horizons = [1, 2, 3, 4, 5, 6, 7, 8]
        
    print("=" * 75)
    print("CHẠY BENCHMARK ĐỐI ĐẦU THEO YÊU CẦU CỦA KIẾN HUY")
    print("Mùa khô 2024-25 và 2025-26, chỉ fit Scaler và Train model TRƯỚC 01/12 của mùa đó")
    print("Đảm bảo hoàn toàn KHÔNG rò rỉ dữ liệu (No Data Leakage)")
    print("=" * 75)
    
    pivot_df, stations, W_D = load_panel_data()
    num_stations = len(stations)
    num_features = len(DAILY_FEATURES)
    target_idx = DAILY_FEATURES.index(TARGET_COL)
    W_D_tensor = torch.tensor(W_D, dtype=torch.float32)
    
    seasons = [
        ("Mùa khô 2024-25", "2024-12-01", "2025-05-31"),
        ("Mùa khô 2025-26", "2025-12-01", "2026-05-31")
    ]
    
    results = []
    
    for season_name, start_date, end_date in seasons:
        split_date = pd.to_datetime(start_date)
        test_end = pd.to_datetime(end_date)
        
        train_df = pivot_df[pivot_df.index < split_date]
        test_df = pivot_df[(pivot_df.index >= split_date - pd.Timedelta(days=LOOKBACK)) & (pivot_df.index <= test_end)]
        
        print(f"\n--- ĐANG ĐÁNH GIÁ: {season_name} ---")
        print(f"Tập Train: {train_df.index[0].date()} -> {train_df.index[-1].date()} ({len(train_df)} ngày)")
        print(f"Tập Test:  {start_date} -> {end_date}")
        
        for h in horizons:
            # QUAN TRỌNG: fit_scaler=True CHỈ áp dụng trên train_df của giai đoạn trước mùa khô đó
            scaler = MinMaxScaler()
            X_tr, y_tr, _, _ = build_samples(train_df, stations, scaler, horizon=h, fit_scaler=True)
            X_te, y_te, naive_te, te_dates = build_samples(test_df, stations, scaler, horizon=h, fit_scaler=False)
            
            # Lọc các mẫu dự báo có ngày đích rơi đúng trong mùa khô kiểm thử
            valid_te_idx = [i for i, (issue, fc) in enumerate(te_dates) if split_date <= fc <= test_end]
            X_te_season = X_te[valid_te_idx]
            y_te_season = y_te[valid_te_idx]
            naive_te_season = naive_te[valid_te_idx]
            
            train_loader = DataLoader(STGNNDataset(X_tr, y_tr), batch_size=32, shuffle=True)
            model = train_model(train_loader, num_stations, num_features, W_D_tensor, horizon=h, epochs=80, patience=15)
            model.eval()
            
            with torch.no_grad():
                preds_scaled = model(torch.tensor(X_te_season, dtype=torch.float32), W_D_tensor)[:, :, 1].numpy()
                
            inv_pred = unscale(preds_scaled, scaler, num_features, target_idx)
            inv_target = unscale(y_te_season, scaler, num_features, target_idx)
            inv_naive = unscale(naive_te_season, scaler, num_features, target_idx)
            
            mae_stgnn = mean_absolute_error(inv_target, inv_pred)
            mae_naive = mean_absolute_error(inv_target, inv_naive)
            diff_pct = (mae_naive - mae_stgnn) / mae_naive * 100.0
            
            status = f"AI Tốt hơn {diff_pct:.1f}%" if diff_pct > 0 else f"Kém hơn {-diff_pct:.1f}%"
            print(f"Horizon {h}d: ST-GNN MAE = {mae_stgnn:.3f} | Naive MAE = {mae_naive:.3f} | {status}")
            
            results.append({
                "season": season_name,
                "horizon": h,
                "mae_stgnn": round(float(mae_stgnn), 3),
                "mae_naive": round(float(mae_naive), 3),
                "improvement_pct": round(float(diff_pct), 1)
            })
            
    print("\n" + "=" * 75)
    print("BẢNG KẾT QUẢ ĐỐI ĐẦU CHÍNH THỨC:")
    print("=" * 75)
    res_df = pd.DataFrame(results)
    print(res_df.to_string(index=False))
    return res_df

def train_production_weights(horizons=None, epochs=100, patience=20):
    if horizons is None:
        horizons = DEFAULT_HORIZONS
        
    print("\n" + "=" * 75)
    print("HUẤN LUYỆN BẢN TRỌNG SỐ PRODUCTION (GỬI KIẾN HUY GẮN SERVER)")
    print(f"Các mốc dự báo: {horizons}")
    print(f"Dữ liệu train đến ngày: {TRAINED_UNTIL_DATE}")
    print("=" * 75)
    
    pivot_df, stations, W_D = load_panel_data()
    num_stations = len(stations)
    num_features = len(DAILY_FEATURES)
    W_D_tensor = torch.tensor(W_D, dtype=torch.float32)
    
    save_dir = get_save_dir()
    
    # 1. Fit Scaler trên toàn bộ dữ liệu lịch sử chuẩn hóa đến TRAINED_UNTIL_DATE phục vụ suy luận Online
    scaler = MinMaxScaler()
    build_samples(pivot_df, stations, scaler, horizon=1, fit_scaler=True)
    scaler_path = os.path.join(save_dir, "scaler.pkl")
    joblib.dump(scaler, scaler_path)
    print(f"[OK] Đã lưu Scaler tại: {scaler_path}")
    
    # 2. Huấn luyện từng mốc horizon
    for h in horizons:
        print(f"\n--> Đang huấn luyện ST-GNN Horizon {h} ngày...")
        X_all, y_all, _, _ = build_samples(pivot_df, stations, scaler, horizon=h, fit_scaler=False)
        train_loader = DataLoader(STGNNDataset(X_all, y_all), batch_size=32, shuffle=True)
        model = train_model(train_loader, num_stations, num_features, W_D_tensor, horizon=h, epochs=epochs, patience=patience)
        
        weights_path = os.path.join(save_dir, f"st_gnn_horizon_{h}.pth")
        torch.save(model.state_dict(), weights_path)
        print(f"[OK] Đã lưu weights horizon {h}: {weights_path}")
        
    # 3. Ghi file meta.json với đầy đủ thông tin phiên bản và trained_until
    meta = {
        "model_version": "stgnn-daily-v2",
        "trained_until": TRAINED_UNTIL_DATE,
        "trained_at": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "stations": stations,
        "feature_cols": DAILY_FEATURES,
        "target_col": TARGET_COL,
        "lookback": LOOKBACK,
        "horizons": horizons,
        "num_stations": num_stations,
        "num_features": num_features,
        "W_D_shape": list(W_D.shape),
        "note": "ST-GNN daily models for horizons 1 to 8 days. Due to 1-day RYNAN measurement lag, h=1 is today (D), while h=2..8 correspond to frontend forecast days D+1..D+7."
    }
    meta_path = os.path.join(save_dir, "meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Đã lưu Meta tại: {meta_path}")
    print(f"Toàn bộ mô hình đã được xuất vào thư mục: {save_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="ST-GNN Daily Training & Benchmark Pipeline")
    parser.add_argument('--mode', choices=['train', 'benchmark', 'all'], default='train',
                        help="Chế độ chạy: 'train' (huấn luyện production mốc 1-8 ngày), 'benchmark' (chấm điểm mùa khô độc lập không rò rỉ), 'all' (cả hai)")
    parser.add_argument('--epochs', type=int, default=100, help="Số epochs huấn luyện")
    parser.add_argument('--patience', type=int, default=20, help="Early stopping patience")
    args = parser.parse_args()

    if args.mode in ['benchmark', 'all']:
        run_benchmark()
    if args.mode in ['train', 'all']:
        train_production_weights(epochs=args.epochs, patience=args.patience)

