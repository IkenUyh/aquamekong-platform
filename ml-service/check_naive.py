import sys
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error
from app.pipeline.dataset_loader import DataLoaderService

def main():
    loader = DataLoaderService(lookback=14, horizon=1)
    pivot_df, num_stations = loader.load_raw_data()
    
    # Extract the target column (salinity_max)
    target_data = pivot_df[loader.target_col][loader.stations].values
    
    num_dates = len(target_data)
    test_size = 0.2
    
    # Same temporal split as the dataset loader
    # The dataset loader creates sliding windows first, then splits.
    # Total windows: num_dates - lookback - horizon + 1
    total_windows = num_dates - loader.lookback - loader.horizon + 1
    split_idx = int(total_windows * (1 - test_size))
    
    # Test indices for target y
    # y[i] corresponds to target_data[i + lookback + horizon - 1]
    # For Naive model: prediction for y[i] is target_data[i + lookback - 1]
    
    test_targets = []
    test_preds = []
    
    for i in range(split_idx, total_windows):
        true_y = target_data[i + loader.lookback + loader.horizon - 1]
        naive_pred = target_data[i + loader.lookback - 1]
        
        test_targets.append(true_y)
        test_preds.append(naive_pred)
        
    test_targets = np.array(test_targets)
    test_preds = np.array(test_preds)
    
    rmse = np.sqrt(mean_squared_error(test_targets, test_preds))
    mae = mean_absolute_error(test_targets, test_preds)
    
    print(f"Naive Baseline RMSE: {rmse:.4f}")
    print(f"Naive Baseline MAE: {mae:.4f}")

if __name__ == '__main__':
    main()
