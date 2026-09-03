import os
import sys
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.optim import Adam
from sklearn.metrics import mean_squared_error, mean_absolute_error
from statsmodels.tsa.arima.model import ARIMA
import warnings
warnings.filterwarnings("ignore")

# Add ml-service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.pipeline.dataset_loader import DataLoaderService, MekongDataset
from torch.utils.data import DataLoader
from app.models.hybrid_arima_cnn import ResidualCNN

def train_hybrid():
    print("Initialize Data Loader...")
    loader_service = DataLoaderService(lookback=14, horizon=1)
    
    # 1. Load Raw Data and scale it
    df = loader_service.load_raw_data()
    df[loader_service.feature_cols] = loader_service.scaler.fit_transform(df[loader_service.feature_cols])
    
    print("Phase 1: Fitting ARIMA models to extract residuals...")
    # To keep it fast and simple for the baseline, we fit a global ARIMA(1,0,0) for the target features.
    # In a full production system, we would fit one ARIMA per station.
    
    # Fit ARIMA for water_level_max
    wl_series = df['water_level_max'].values
    arima_wl = ARIMA(wl_series, order=(1,0,0)).fit()
    df['wl_residual'] = wl_series - arima_wl.fittedvalues
    
    # Fit ARIMA for salinity_max
    sal_series = df['salinity_max'].values
    arima_sal = ARIMA(sal_series, order=(1,0,0)).fit()
    df['sal_residual'] = sal_series - arima_sal.fittedvalues
    
    # We will use the residuals of water_level_max and salinity_max as inputs to the CNN
    hybrid_features = ['wl_residual', 'sal_residual']
    target_col = 'sal_residual'
    
    print("Preparing sliding windows on residuals...")
    X_all, y_all, y_arima_base = [], [], []
    
    for station_id, group in df.groupby('station_id'):
        group = group.sort_values('date').reset_index(drop=True)
        values = group[hybrid_features].values
        target_idx = hybrid_features.index(target_col)
        
        # We also need to keep track of the ARIMA baseline prediction for the target day
        # so we can add it back to the CNN's residual prediction later.
        base_sal_preds = arima_sal.fittedvalues[group.index]
        
        for i in range(len(values) - loader_service.lookback - loader_service.horizon + 1):
            X_window = values[i : i + loader_service.lookback]
            # Target is the residual of salinity horizon days ahead
            target_idx_time = i + loader_service.lookback + loader_service.horizon - 1
            y_res_value = values[target_idx_time, target_idx]
            
            # The base ARIMA prediction for that target day
            base_pred = base_sal_preds[target_idx_time]
            
            X_all.append(X_window)
            y_all.append(y_res_value)
            y_arima_base.append(base_pred)
            
    X_all = np.array(X_all)
    y_all = np.array(y_all).reshape(-1, 1)
    y_arima_base = np.array(y_arima_base).reshape(-1, 1)
    
    test_size = 0.2
    split_idx = int(len(X_all) * (1 - test_size))
    
    X_train, y_train = X_all[:split_idx], y_all[:split_idx]
    X_test, y_test = X_all[split_idx:], y_all[split_idx:]
    y_arima_test = y_arima_base[split_idx:]
    
    train_dataset = MekongDataset(X_train, y_train)
    test_dataset = MekongDataset(X_test, y_test)
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    print("Phase 2: Training 1D-CNN on Residuals...")
    # Input size is 2 (wl_residual, sal_residual)
    model = ResidualCNN(input_size=2, hidden_channels=32, output_size=1).to(device)
    criterion = nn.MSELoss()
    optimizer = Adam(model.parameters(), lr=0.001)
    
    epochs = 50
    for epoch in range(epochs):
        model.train()
        train_loss = 0
        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            
            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
            
        print(f"Epoch {epoch+1}/{epochs} | CNN Residual Loss: {train_loss/len(train_loader):.4f}")
        
    print("\nPhase 3: Evaluating Hybrid Model on Test Set...")
    model.eval()
    cnn_res_preds = []
    
    with torch.no_grad():
        for X_batch, _ in test_loader:
            X_batch = X_batch.to(device)
            outputs = model(X_batch)
            cnn_res_preds.extend(outputs.cpu().numpy())
            
    cnn_res_preds = np.array(cnn_res_preds)
    
    # Final Prediction = ARIMA Prediction + CNN Residual Prediction
    final_preds_scaled = y_arima_test + cnn_res_preds
    final_targets_scaled = y_arima_test + y_test
    
    # Inverse transform to get real-world metrics (RMSE, MAE)
    # Target is salinity_max, which is the 4th feature (index 3) in the original scaler
    target_idx = 3
    dummy_preds = np.zeros((len(final_preds_scaled), 4))
    dummy_targets = np.zeros((len(final_targets_scaled), 4))
    
    dummy_preds[:, target_idx] = final_preds_scaled.squeeze()
    dummy_targets[:, target_idx] = final_targets_scaled.squeeze()
    
    real_preds = loader_service.scaler.inverse_transform(dummy_preds)[:, target_idx]
    real_targets = loader_service.scaler.inverse_transform(dummy_targets)[:, target_idx]
    
    rmse = np.sqrt(mean_squared_error(real_targets, real_preds))
    mae = mean_absolute_error(real_targets, real_preds)
    
    print("\n" + "="*40)
    print("HYBRID AI (ARIMA + CNN) EVALUATION RESULTS")
    print("="*40)
    print(f"Model: ARIMA(1,0,0) + 1D-CNN")
    print(f"Dataset: CS Bàn Giao (160 files)")
    print(f"Root Mean Square Error (RMSE): {rmse:.4f} ‰")
    print(f"Mean Absolute Error (MAE):     {mae:.4f} ‰")
    print("="*40)

    # Save model weights
    save_dir = os.path.join(os.path.dirname(__file__), '..', 'trained_models')
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, 'hybrid_cnn.pth')
    torch.save(model.state_dict(), save_path)
    print(f"\n[+] CNN Residual weights saved successfully to: {save_path}")

if __name__ == '__main__':
    train_hybrid()
