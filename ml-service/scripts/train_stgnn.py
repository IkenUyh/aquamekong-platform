import os
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import joblib
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from app.pipeline.dataset_loader import DataLoaderService
from app.models.st_gnn import STGNN
from app.config import get_settings

settings = get_settings()

class PinballLoss(nn.Module):
    def __init__(self, quantiles=[0.1, 0.5, 0.9]):
        super(PinballLoss, self).__init__()
        self.quantiles = quantiles

    def forward(self, pred, target):
        # pred shape: [Batch, Stations, 3]
        # target shape: [Batch, Stations]
        target = target.unsqueeze(-1) # [Batch, Stations, 1]
        losses = []
        for i, q in enumerate(self.quantiles):
            err = target[:, :, 0] - pred[:, :, i]
            # Pinball loss formula: max(q * err, (q-1) * err)
            loss_q = torch.max(q * err, (q - 1.0) * err)
            losses.append(loss_q)
        return torch.mean(torch.stack(losses, dim=-1))

def run_experiment(horizon):
    print(f"\n{'='*50}")
    print(f"BẮT ĐẦU HUẤN LUYỆN ST-GNN (HORIZON = {horizon} NGÀY) - VỚI TRỌNG SỐ MÙA KHÔ")
    print(f"{'='*50}")
    
    loader_service = DataLoaderService(lookback=14, horizon=horizon)
    train_loader, test_loader, scaler, W_D_np, num_stations = loader_service.prepare_data(test_size=0.2)
    W_D = torch.tensor(W_D_np, dtype=torch.float32)
    
    model = STGNN(num_stations=num_stations, num_features=12, lookback=14, d=8, horizon=horizon)
    
    # SỬ DỤNG PINBALL LOSS ĐỂ HUẤN LUYỆN 3 DẢI XÁC SUẤT (10%, 50%, 90%)
    criterion = PinballLoss(quantiles=[0.1, 0.5, 0.9])
    optimizer = optim.Adam(model.parameters(), lr=0.005, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=10, verbose=True)
    
    epochs = 300
    patience = 40
    best_loss = float('inf')
    early_stop_counter = 0
    best_model_state = None
    
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for X_batch, y_batch in train_loader:
            optimizer.zero_grad()
            outputs = model(X_batch, W_D)
            loss = criterion(outputs, y_batch)
            loss.backward()
            
            # Gradient clipping to prevent exploding gradients
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            
            optimizer.step()
            train_loss += loss.item() * X_batch.size(0)
            
        train_loss /= len(train_loader.dataset)
        scheduler.step(train_loss)
        
        # Early Stopping
        if train_loss < best_loss:
            best_loss = train_loss
            early_stop_counter = 0
            best_model_state = model.state_dict()
        else:
            early_stop_counter += 1
            
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"Epoch [{epoch+1}/{epochs}], Loss: {train_loss:.6f} | EarlyStop: {early_stop_counter}/{patience}", flush=True)
            
        if early_stop_counter >= patience:
            print(f"Early stopping kích hoạt tại Epoch {epoch+1}")
            break
            
    print("Huấn luyện hoàn tất. Khôi phục trọng số tốt nhất và bắt đầu đánh giá...")
    model.load_state_dict(best_model_state)
    
    model.eval()
    all_preds, all_targets, all_naive = [], [], []
    
    with torch.no_grad():
        for X_batch, y_batch in test_loader:
            outputs = model(X_batch, W_D)
            # Trích xuất dải trung bình (Phân vị 50% - index 1) để tính điểm
            all_preds.append(outputs[:, :, 1].numpy())
            all_targets.append(y_batch.numpy())
            
            # Retrieve naive prediction (last known value in the lookback window)
            # X_batch shape: (Batch, N, Lookback, Features)
            # target_idx is the index for salinity_max
            target_idx = loader_service.feature_cols.index(loader_service.target_col)
            # The last value in lookback is at index -1
            naive_pred = X_batch[:, :, -1, target_idx].numpy()
            all_naive.append(naive_pred)
            
    all_preds = np.concatenate(all_preds, axis=0) 
    all_targets = np.concatenate(all_targets, axis=0)
    all_naive = np.concatenate(all_naive, axis=0)
    
    # Inverse transform
    def inverse_transform_targets(scaled_targets):
        dummy = np.zeros((scaled_targets.size, len(loader_service.feature_cols)))
        target_idx = loader_service.feature_cols.index(loader_service.target_col)
        dummy[:, target_idx] = scaled_targets.flatten()
        return scaler.inverse_transform(dummy)[:, target_idx]
        
    inv_preds = inverse_transform_targets(all_preds)
    inv_targets = inverse_transform_targets(all_targets)
    inv_naive = inverse_transform_targets(all_naive)
    
    stgnn_rmse = np.sqrt(mean_squared_error(inv_targets, inv_preds))
    stgnn_mae = mean_absolute_error(inv_targets, inv_preds)
    stgnn_r2 = r2_score(inv_targets, inv_preds)
    
    naive_rmse = np.sqrt(mean_squared_error(inv_targets, inv_naive))
    naive_mae = mean_absolute_error(inv_targets, inv_naive)
    naive_r2 = r2_score(inv_targets, inv_naive)
    
    print("\n--- KẾT QUẢ ĐÁNH GIÁ ---")
    print(f"Dự báo trước: {horizon} ngày (Horizon={horizon})")
    print(f"Naive Baseline (Copy quá khứ): RMSE = {naive_rmse:.4f} | MAE = {naive_mae:.4f} | R2 = {naive_r2:.4f}")
    print(f"ST-GNN (AI Dự báo):          RMSE = {stgnn_rmse:.4f} | MAE = {stgnn_mae:.4f} | R2 = {stgnn_r2:.4f}")
    
    if stgnn_rmse < naive_rmse and stgnn_r2 > naive_r2:
        print("=> XUẤT SẮC: ST-GNN ĐÃ CHIẾN THẮNG NAIVE BASELINE TOÀN DIỆN!")
    else:
        print("=> CẦN CẢI THIỆN: ST-GNN vẫn chưa vượt trội so với copy quá khứ.")
        
    save_dir = "trained_models"
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, f"st_gnn_horizon_{horizon}.pth")
    torch.save(model.state_dict(), save_path)
    
    # LƯU SCALER ĐỂ CHẠY THỰC TẾ (INFERENCE)
    scaler_path = os.path.join(save_dir, "st_gnn_scaler.pkl")
    joblib.dump(scaler, scaler_path)
    print(f"Đã lưu mô hình tại: {save_path}")
    print(f"Đã lưu Scaler tại: {scaler_path}")
    
if __name__ == "__main__":
    # Test 1 day ahead
    run_experiment(horizon=1)
    # Test 7 days ahead (where ST-GNN truly shines)
    run_experiment(horizon=7)
