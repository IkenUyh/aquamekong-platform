"""
Chuẩn bị đầu vào giống hệt scripts/train_stgnn.py (DataLoaderService.load_raw_data: lọc trạm,
IDW, nội suy thời gian), để lúc chạy không lệch với lúc train.
"""

import numpy as np

from app.config import get_settings
from app.pipeline.dataset_loader import DataLoaderService

LOOKBACK = 14


def make_loader(horizon: int = 1, features_dir=None) -> DataLoaderService:
    return DataLoaderService(data_dir=features_dir or get_settings().features_dir, lookback=LOOKBACK, horizon=horizon)


def panel_array(pivot_df, feature_cols, stations) -> np.ndarray:
    """(số ngày, số trạm, số feature), cùng thứ tự với prepare_data."""
    return np.stack([pivot_df[f][list(stations)].values for f in feature_cols], axis=-1)


def scale(x: np.ndarray, min_, scale_) -> np.ndarray:
    """Giống MinMaxScaler.transform: x * scale_ + min_."""
    return x * np.asarray(scale_) + np.asarray(min_)


def unscale_target(v, min_, scale_, target_idx: int):
    return (np.asarray(v) - min_[target_idx]) / scale_[target_idx]
