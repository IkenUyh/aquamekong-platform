"""
Hai mô hình phân vị (20% và 80%) của độ mặn ngày D+h. Học trên thang log phần thay đổi so với số mới nhất
(log1p(mục tiêu) - log1p(s0)): độ mặn từ 0,1 đến hơn 20‰, thang log giúp các đợt tăng vọt bớt kéo lệch mô hình.
Phân vị không đổi qua biến đổi đơn điệu, nên đổi ngược về ‰ vẫn là phân vị của độ mặn.
"""

from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from app.early_warning.features import FEATURES, STATION_FEATURE

LOWER_QUANTILE = 0.2
# Mức "có thể lên tới" để báo sớm. Chạy lại trên các mùa khô 2022-23..2025-26 (ngưỡng 4‰): phân vị 0,7 báo trúng
# nhiều hơn nhưng bắt được ít lần vượt hơn, 0,9 bắt nhiều hơn nhưng quá nửa số lần báo là nhầm
UPPER_QUANTILE = 0.8


def _regressor(quantile: float) -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(loss="quantile", quantile=quantile, max_iter=300, learning_rate=0.05,
                                         max_leaf_nodes=31, min_samples_leaf=40, l2_regularization=1.0,
                                         random_state=0, categorical_features=[STATION_FEATURE])


@dataclass
class RiskModel:
    lower: HistGradientBoostingRegressor
    upper: HistGradientBoostingRegressor

    @classmethod
    def train(cls, rows: pd.DataFrame) -> "RiskModel":
        """rows: dòng của build_rows có mục tiêu (target không trống)."""
        x = rows[FEATURES]
        y = np.log1p(rows["target"].to_numpy(dtype=float)) - np.log1p(rows["s0"].to_numpy(dtype=float))
        return cls(lower=_regressor(LOWER_QUANTILE).fit(x, y), upper=_regressor(UPPER_QUANTILE).fit(x, y))

    def predict(self, rows: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        (phân vị 20%, phân vị 80% = mức có thể lên tới) theo ‰. Không kéo theo số mới nhất: cảnh báo dùng đúng phân vị
        của mô hình (kéo lên bằng số mới nhất thì sau mỗi lần vượt, cảnh báo tự giữ thêm 7 ngày dù mô hình thấy đã giảm).
        """
        if rows.empty:
            return np.array([]), np.array([])
        x = rows[FEATURES]
        log_s0 = np.log1p(rows["s0"].to_numpy(dtype=float))
        lower = np.clip(np.expm1(log_s0 + self.lower.predict(x)), 0, None)
        upper = np.expm1(log_s0 + self.upper.predict(x))
        return lower, np.maximum(upper, lower)


def station_codes(panel: pd.DataFrame) -> Dict[int, int]:
    """Mã số 0..n-1 cho đặc trưng station (HistGradientBoosting cần mã nhỏ, id trạm có thể lớn)."""
    return {int(sid): i for i, sid in enumerate(sorted(panel["station_id"].unique()))}
