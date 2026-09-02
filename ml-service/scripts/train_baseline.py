import os
import sys
import torch
import torch.nn as nn
import numpy as np
from torch.optim import Adam
from sklearn.metrics import mean_squared_error, mean_absolute_error

# Add ml-service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.pipeline.dataset_loader import DataLoaderService
from app.models.baseline_lstm import BaselineLSTM

def train_baseline():
    print("Initialize Data Loader...")
    # Look back 14 days, predict 1 day ahead for simpler baseline
    loader_service = DataLoaderService(lookback=14, horizon=1)
    train_loader, test_loader, scaler = loader_service.prepare_data(test_size=0.2)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # 4 features: water_level_min, water_level_max, salinity_min, salinity_max
    model = BaselineLSTM(input_size=4, hidden_size=64, num_layers=2, output_size=1).to(device)
    criterion = nn.MSELoss()
    optimizer = Adam(model.parameters(), lr=0.001)
    
    epochs = 50
    
    print(f"Starting Training for {epochs} epochs...")
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
            
        print(f"Epoch {epoch+1}/{epochs} | Loss: {train_loss/len(train_loader):.4f}")
        
    print("\nEvaluating Model on Test Set...")
    model.eval()
    all_preds = []
    all_targets = []
    
    with torch.no_grad():
        for X_batch, y_batch in test_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            outputs = model(X_batch)
            all_preds.extend(outputs.cpu().numpy())
            all_targets.extend(y_batch.cpu().numpy())
            
    # Inverse transform to get real-world metrics (RMSE, MAE)
    # Target is salinity_max, which is the 4th feature (index 3)
    target_idx = 3
    
    # Create dummy arrays to use the scaler's inverse_transform
    dummy_preds = np.zeros((len(all_preds), 4))
    dummy_targets = np.zeros((len(all_targets), 4))
    
    dummy_preds[:, target_idx] = np.array(all_preds).squeeze()
    dummy_targets[:, target_idx] = np.array(all_targets).squeeze()
    
    real_preds = scaler.inverse_transform(dummy_preds)[:, target_idx]
    real_targets = scaler.inverse_transform(dummy_targets)[:, target_idx]
    
    rmse = np.sqrt(mean_squared_error(real_targets, real_preds))
    mae = mean_absolute_error(real_targets, real_preds)
    
    print("\n" + "="*40)
    print("BASELINE AI EVALUATION RESULTS")
    print("="*40)
    print(f"Model: LSTM")
    print(f"Dataset: CS Bàn Giao (160 files)")
    print(f"Root Mean Square Error (RMSE): {rmse:.4f} ‰")
    print(f"Mean Absolute Error (MAE):     {mae:.4f} ‰")
    print("="*40)

    # Save model weights
    save_dir = os.path.join(os.path.dirname(__file__), '..', 'trained_models')
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, 'baseline_lstm.pth')
    torch.save(model.state_dict(), save_path)
    print(f"\n[+] Model weights saved successfully to: {save_path}")

if __name__ == '__main__':
    train_baseline()
