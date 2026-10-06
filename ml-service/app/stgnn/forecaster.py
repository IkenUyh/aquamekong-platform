"""
Chạy ST-GNN trên 14 ngày cuối của kho feature. Một lần chạy cho cả đồ thị (mọi trạm của model),
kết quả giữ trong bộ nhớ tới khi kho feature hoặc weights đổi.

Dự báo tính từ ngày cuối có dữ liệu (data_end), không phải từ hôm nay: kho feature cũ thì
dự báo cũng là cho những ngày đã qua, và giao diện ghi rõ điều đó.
"""

import logging
import threading
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional

import numpy as np
import torch

from app.ingest.features_store import features_path
from app.models.st_gnn import STGNN
from app.stgnn import artifact
from app.stgnn.data import LOOKBACK, make_loader, panel_array, scale, unscale_target

logger = logging.getLogger(__name__)


@dataclass
class StationForecast:
    horizon: int
    date: date
    q10: float
    q50: float
    q90: float


@dataclass
class GraphForecast:
    data_end: date
    by_station: Dict[str, List[StationForecast]]


class StgnnForecaster:
    def __init__(self, model_dir=None, features_dir=None):
        self.model_dir = model_dir
        self.features_dir = features_dir
        self._lock = threading.Lock()
        self._key = None
        self._result: Optional[GraphForecast] = None

    def _state_key(self):
        meta_file = artifact.artifact_dir(self.model_dir) / artifact.META_FILE
        feats = features_path(self.features_dir)
        if not meta_file.exists() or not feats.exists():
            return None
        return meta_file.stat().st_mtime_ns, feats.stat().st_mtime_ns

    def meta(self) -> Optional[dict]:
        return artifact.read_meta(self.model_dir)

    def eligible(self, meta: dict, station_code: str) -> bool:
        """Chỉ dùng ST-GNN cho trạm mà trên tập test dự báo xa nhất tốt hơn giữ nguyên giá trị cũ."""
        if station_code not in meta["stations"]:
            return False
        ev = meta["evaluation"][f"h{max(meta['horizons'])}"]["per_station"].get(station_code)
        return bool(ev) and ev["stgnn"]["mae"] < ev["naive"]["mae"]

    def forecast_graph(self) -> Optional[GraphForecast]:
        key = self._state_key()
        if key is None:
            return None
        with self._lock:
            if key != self._key:
                self._result = self._run()
                self._key = key
            return self._result

    def _run(self) -> Optional[GraphForecast]:
        meta = self.meta()
        loader = make_loader(features_dir=self.features_dir)
        pivot_df, n = loader.load_raw_data()
        if list(loader.stations) != meta["stations"]:
            # Bộ lọc trạm phụ thuộc dữ liệu: dữ liệu mới làm đổi danh sách trạm thì đồ thị không còn khớp weights
            logger.warning("ST-GNN: danh sách trạm từ kho feature khác lúc train, bỏ qua ST-GNN tới khi train lại.")
            return None

        feats, target = meta["feature_cols"], meta["target_col"]
        tgt = feats.index(target)
        min_, scale_ = np.asarray(meta["scaler"]["min_"]), np.asarray(meta["scaler"]["scale_"])
        window = scale(panel_array(pivot_df, feats, meta["stations"])[-LOOKBACK:], min_, scale_)
        x = torch.tensor(np.transpose(window, (1, 0, 2))[None], dtype=torch.float32)  # (1, N, L, F)
        w_d = torch.tensor(loader.W_D, dtype=torch.float32)
        data_end = pivot_df.index[-1].date()

        by_station: Dict[str, List[StationForecast]] = {code: [] for code in meta["stations"]}
        for h in meta["horizons"]:
            model = STGNN(num_stations=n, num_features=len(feats), lookback=LOOKBACK, horizon=h)
            model.load_state_dict(torch.load(artifact.weights_path(h, self.model_dir), map_location="cpu", weights_only=True))
            model.eval()
            with torch.no_grad():
                out = model(x, w_d)[0].numpy()  # (N, 3) = Q10, Q50, Q90 đã scale
            values = np.maximum(np.sort(unscale_target(out, min_, scale_, tgt), axis=1), 0.0)
            for i, code in enumerate(meta["stations"]):
                q10, q50, q90 = (round(float(v), 3) for v in values[i])
                by_station[code].append(StationForecast(h, data_end + timedelta(days=h), q10, q50, q90))
        logger.info(f"ST-GNN: dự báo {len(meta['horizons'])} mốc cho {n} trạm từ dữ liệu ngày {data_end}")
        return GraphForecast(data_end, by_station)

    def forecast(self, station_code: str, days_ahead: int) -> Optional[GraphForecast]:
        """Dự báo cho 1 trạm, hoặc None nếu ST-GNN không dùng được cho trạm/khoảng này."""
        meta = self.meta()
        if not meta or days_ahead > max(meta["horizons"]) or not self.eligible(meta, station_code):
            return None
        graph = self.forecast_graph()
        if graph is None or station_code not in graph.by_station:
            return None
        return GraphForecast(graph.data_end, {station_code: graph.by_station[station_code]})


forecaster = StgnnForecaster()
