import os
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error
from app.pipeline.dataset_loader import DataLoaderService
from app.models.st_gnn import STGNN
from app.config import get_settings

settings = get_settings()

def train():
    print("Loading and preparing data for ST-GNN...")
    # Initialize DataLoaderService
    loader_service = DataLoaderService(lookback=14, horizon=1)
    
    train_loader, test_loader, scaler, W_D_np, num_stations = loader_service.prepare_data(test_size=0.2)
    
    # Convert W_D to tensor
    W_D = torch.tensor(W_D_np, dtype=torch.float32)
    
    print(f"Data loaded successfully! Number of stations: {num_stations}")
    
    # Define ST-GNN model
    model = STGNN(num_stations=num_stations, num_features=4, lookback=14, d=8)
    
    # Training configuration
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    epochs = 50
    
    print("Starting Training ST-GNN...")
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for X_batch, y_batch in train_loader:
            optimizer.zero_grad()
            # Forward pass
            outputs = model(X_batch, W_D)
            loss = criterion(outputs, y_batch)
            
            # Backward pass and optimize
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * X_batch.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"Epoch [{epoch+1}/{epochs}], Loss: {train_loss:.6f}")
            
    print("Training Completed.")
    
    # Evaluate model
    model.eval()
    all_preds = []
    all_targets = []
    
    print("Evaluating model on test set...")
    with torch.no_grad():
        for X_batch, y_batch in test_loader:
            outputs = model(X_batch, W_D)
            all_preds.append(outputs.numpy())
            all_targets.append(y_batch.numpy())
            
    all_preds = np.concatenate(all_preds, axis=0) # Shape: (Test_Size, N)
    all_targets = np.concatenate(all_targets, axis=0)
    
    # We must inverse transform to get actual RMSE / MAE
    # The scaler expects (N_samples, N_features).
    # Since our target is 'salinity_max' (index 3), we need a dummy array to inverse_transform.
    dummy_preds = np.zeros((all_preds.size, len(loader_service.feature_cols)))
    dummy_targets = np.zeros((all_targets.size, len(loader_service.feature_cols)))
    
    # Place predictions/targets into the target column
    target_idx = loader_service.feature_cols.index(loader_service.target_col)
    dummy_preds[:, target_idx] = all_preds.flatten()
    dummy_targets[:, target_idx] = all_targets.flatten()
    
    inv_preds = scaler.inverse_transform(dummy_preds)[:, target_idx]
    inv_targets = scaler.inverse_transform(dummy_targets)[:, target_idx]
    
    # Calculate metrics
    rmse = np.sqrt(mean_squared_error(inv_targets, inv_preds))
    mae = mean_absolute_error(inv_targets, inv_preds)
    
    print("="*40)
    print("ST-GNN PERFORMANCE METRICS")
    print(f"RMSE: {rmse:.4f} ‰")
    print(f"MAE:  {mae:.4f} ‰")
    print("="*40)
    
    # Save model weights
    save_dir = os.path.join("ml-service", "trained_models")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, "st_gnn.pth")
    torch.save(model.state_dict(), save_path)
    print(f"Model weights saved to {save_path}")

if __name__ == "__main__":
    train()
