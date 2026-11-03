import json
import pickle
from datetime import timedelta

import joblib
import numpy as np
import pandas as pd
import pytest

torch = pytest.importorskip("torch")

from app.ingest.features_store import FEATURES_FILE, append_features, features_path
from app.models.st_gnn import STGNN
from app.stgnn import artifact
from app.stgnn.data import make_loader
from app.stgnn.forecaster import StgnnForecaster
from app.stgnn.install import install

STATIONS = [("S1", 9.50, 105.20), ("S2", 9.60, 105.30), ("S3", 9.70, 105.40)]
DAYS = 80


def write_features(directory):
    rng = np.random.default_rng(0)
    rows = []
    for i, (code, lat, lon) in enumerate(STATIONS):
        for d in range(DAYS):
            sal = 1 + i + np.sin(d / 7) + rng.normal(0, 0.1)
            rows.append({
                "station_id": code, "station_name": f"Trạm {code}", "latitude": lat, "longitude": lon,
                "date": (pd.Timestamp("2026-01-01") + timedelta(days=d)).strftime("%Y-%m-%d"),
                "distance_to_river_mouth_km": 10 * (i + 1), "salinity_max": sal, "salinity_max_lag_1d": sal,
                "salinity_max_delta_3d": 0.1, "water_level_max_lag_1d": 100 + d % 10, "water_level_max_roll7d_std": 3.0,
                "upstream_discharge_lag_1d": 2.0 + i, "rainfall_mm_roll7d_sum": d % 5, "tpxo_tide_mean_cm_lag_1d": 0.5,
                "tpxo_tide_range_cm_lag_1d": 60 + d % 3, "day_of_year_sin": np.sin(d), "day_of_year_cos": np.cos(d),
            })
    append_features(pd.DataFrame(rows), directory)


@pytest.fixture
def weights_dir(tmp_path):
    """Kho feature giả + weights khởi tạo ngẫu nhiên + scaler đúng như scripts/train_stgnn.py lưu."""
    feats = tmp_path / "features"
    write_features(feats)
    src = tmp_path / "weights"
    src.mkdir()
    torch.manual_seed(0)
    for h in (1, 7):
        _, _, scaler, _, n = make_loader(h, feats).prepare_data(test_size=0.2)
        model = STGNN(num_stations=n, num_features=12, lookback=14, horizon=h)
        torch.save(model.state_dict(), src / f"st_gnn_horizon_{h}.pth")
    joblib.dump(scaler, src / "st_gnn_scaler.pkl")
    return feats, src, tmp_path / "models"


def test_install_writes_metadata_and_evaluation(weights_dir):
    feats, src, models = weights_dir

    meta = install(src, feats, models)

    assert meta["stations"] == ["S1", "S2", "S3"]
    assert meta["horizons"] == [1, 7]
    assert meta["trained_until"] == "2026-03-21"
    for key in ("h1", "h7"):
        ev = meta["evaluation"][key]
        assert set(ev["overall"]) == {"stgnn", "naive"}
        assert set(ev["per_station"]) == {"S1", "S2", "S3"}
    # meta.json là JSON thuần, đọc lại được mà không cần pickle
    assert json.loads((models / "stgnn" / "meta.json").read_text())["scaler"]["scale_"]


def test_install_rejects_scaler_from_other_data(weights_dir):
    feats, src, models = weights_dir
    scaler = joblib.load(src / "st_gnn_scaler.pkl")
    scaler.data_max_ = scaler.data_max_ * 2
    joblib.dump(scaler, src / "st_gnn_scaler.pkl")

    with pytest.raises(ValueError, match="không khớp"):
        install(src, feats, models)


def test_scaler_pickle_with_other_globals_is_never_loaded(tmp_path):
    evil = tmp_path / "st_gnn_scaler.pkl"
    evil.write_bytes(pickle.dumps(print, protocol=4))

    with pytest.raises(ValueError, match="không được phép"):
        artifact.check_scaler_pickle(evil)


def test_forecast_starts_after_last_data_day_with_ordered_quantiles(weights_dir):
    feats, src, models = weights_dir
    install(src, feats, models)
    forecaster = StgnnForecaster(models, feats)

    graph = forecaster.forecast_graph()

    assert str(graph.data_end) == "2026-03-21"
    for code in ("S1", "S2", "S3"):
        points = graph.by_station[code]
        assert [(p.horizon, str(p.date)) for p in points] == [(1, "2026-03-22"), (7, "2026-03-28")]
        assert all(0 <= p.q10 <= p.q50 <= p.q90 for p in points)


def test_stations_worse_than_naive_fall_back(weights_dir):
    feats, src, models = weights_dir
    meta = install(src, feats, models)
    per_station = meta["evaluation"]["h7"]["per_station"]
    per_station["S1"]["stgnn"]["mae"], per_station["S1"]["naive"]["mae"] = 0.1, 0.5   # tốt hơn
    per_station["S2"]["stgnn"]["mae"], per_station["S2"]["naive"]["mae"] = 0.9, 0.5   # kém hơn
    artifact.write_meta(meta, models)
    forecaster = StgnnForecaster(models, feats)

    assert forecaster.forecast("S1", 7) is not None
    assert forecaster.forecast("S2", 7) is None
    assert forecaster.forecast("S1", 14) is None      # xa hơn horizon lớn nhất
    assert forecaster.forecast("UNKNOWN", 7) is None


def test_no_installed_model_means_no_stgnn(tmp_path):
    assert StgnnForecaster(tmp_path / "models", tmp_path / "features").forecast("S1", 7) is None


def test_features_store_keeps_latest_row_per_station_and_day(tmp_path):
    first = pd.DataFrame([{"station_id": "S1", "date": "2026-01-01", "salinity_max": 1.0},
                          {"station_id": "S1", "date": "2026-01-02", "salinity_max": 2.0}])
    again = pd.DataFrame([{"station_id": "S1", "date": "2026-01-02", "salinity_max": 2.5}])

    append_features(first, tmp_path)
    assert append_features(again, tmp_path) == 2

    stored = pd.read_csv(features_path(tmp_path))
    assert features_path(tmp_path).name == FEATURES_FILE
    assert stored.loc[stored["date"] == "2026-01-02", "salinity_max"].item() == 2.5
