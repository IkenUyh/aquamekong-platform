"""
Ba mô hình phân vị (20%, 50% và 80%) của độ mặn ngày D+h. Học trên thang log phần thay đổi so với số mới nhất
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
# Trung vị: số dự báo ở trạm đủ lịch sử từ mốc service.MODEL_FROM_LEAD ngày (sai số tuyệt đối nhỏ nhất là trung vị)
MEDIAN_QUANTILE = 0.5
MEDIAN_MAX_HORIZON = 7
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
    median: HistGradientBoostingRegressor
    upper: HistGradientBoostingRegressor

    @classmethod
    def train(cls, rows: pd.DataFrame) -> "RiskModel":
        """rows: dòng của build_rows có mục tiêu (target không trống)."""
        x = rows[FEATURES]
        y = np.log1p(rows["target"].to_numpy(dtype=float)) - np.log1p(rows["s0"].to_numpy(dtype=float))
        # Trung vị chỉ dùng tới mốc MEDIAN_MAX_HORIZON ngày, nên chỉ học các mốc đó: học cả mốc 8–16 thì kém đi ở mốc 4–7
        near = (rows["h"] <= MEDIAN_MAX_HORIZON).to_numpy()
        return cls(lower=_regressor(LOWER_QUANTILE).fit(x, y), median=_regressor(MEDIAN_QUANTILE).fit(x[near], y[near]),
                   upper=_regressor(UPPER_QUANTILE).fit(x, y))

    def predict(self, rows: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        (phân vị 20%, trung vị, phân vị 80% = mức có thể lên tới) theo ‰, trung vị nằm giữa hai phân vị kia. Không kéo
        theo số mới nhất: cảnh báo dùng đúng phân vị của mô hình (kéo lên bằng số mới nhất thì sau mỗi lần vượt, cảnh báo
        tự giữ thêm 7 ngày dù mô hình thấy đã giảm).
        """
        if rows.empty:
            return np.array([]), np.array([]), np.array([])
        x = rows[FEATURES]
        log_s0 = np.log1p(rows["s0"].to_numpy(dtype=float))
        lower = np.clip(np.expm1(log_s0 + self.lower.predict(x)), 0, None)
        upper = np.maximum(np.expm1(log_s0 + self.upper.predict(x)), lower)
        median = np.clip(np.expm1(log_s0 + self.median.predict(x)), lower, upper)
        return lower, median, upper


def station_codes(panel: pd.DataFrame) -> Dict[int, int]:
    """Mã số 0..n-1 cho đặc trưng station (HistGradientBoosting cần mã nhỏ, id trạm có thể lớn)."""
    return {int(sid): i for i, sid in enumerate(sorted(panel["station_id"].unique()))}
