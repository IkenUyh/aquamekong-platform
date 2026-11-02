from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from app.schemas.forecast import PredictionItem
from app.stgnn import daily
from app.stgnn.daily import DailyForecaster, DailyGraph, StationForecast, blend, station_features

META = DailyForecaster().meta()
FEATS = META["feature_cols"]
END = date(2026, 10, 15)


def test_features_match_the_feature_store_formulas():
    days = pd.date_range("2026-10-01", periods=12, freq="D")
    s = pd.Series(np.arange(12, dtype=float), index=days)          # độ mặn ngày i = i
    wl = pd.Series(100.0 + 10 * np.arange(12), index=days)
    f = station_features(s, wl, {"distance_to_river_mouth_km": 5.0, "distance_to_coast_km": 2.0}, days, FEATS)
    row = f.loc[days[10]]
    assert row["salinity_max"] == 10 and row["salinity_max_lag_1d"] == 9
    assert row["salinity_max_delta_3d"] == 9 - 6 and row["salinity_max_delta_7d"] == 9 - 2
    assert row["water_level_max_lag_1d"] == 190 and row["water_level_max_lag_7d"] == 130
    assert row["water_level_max_roll7d_std"] == pytest.approx(np.std([130, 140, 150, 160, 170, 180, 190], ddof=1))
    assert list(f.columns) == FEATS


def test_a_day_without_salinity_leaves_measured_features_empty():
    days = pd.date_range("2026-10-01", periods=10, freq="D")
    s = pd.Series(1.0, index=days).drop(days[5])
    f = station_features(s, pd.Series(100.0, index=days), {"distance_to_river_mouth_km": 5.0, "distance_to_coast_km": 2.0}, days, FEATS)
    assert f.loc[days[5], "salinity_max_lag_1d"] != f.loc[days[5], "salinity_max_lag_1d"]   # NaN
    assert f.loc[days[5], "distance_to_coast_km"] == 2.0


def _graph(code="A"):
    by = [StationForecast(h, END + timedelta(days=h), 0.1, 1.0 + h, 9.0) for h in range(1, 9)]
    return DailyGraph(END, {code: END}, {code: by})


def test_blend_uses_stgnn_up_to_day_four_then_the_average():
    items = [PredictionItem(date=END + timedelta(days=k), salinity=2.0, lower_bound=1.5, upper_bound=2.5, risk_salinity=2.5,
                            model_version="gb-risk-v2") for k in range(2, 11)]
    out = blend(items, _graph(), "A", "stgnn-daily-v2+gb-risk-v2")

    by_lead = {(i.date - END).days: i.salinity for i in out}
    assert [by_lead[h] for h in (2, 3, 4)] == [3.0, 4.0, 5.0]                     # ST-GNN
    assert [by_lead[h] for h in (5, 8)] == [(6.0 + 2.0) / 2, (9.0 + 2.0) / 2]     # trung bình
    assert [by_lead[h] for h in (9, 10)] == [2.0, 2.0]                             # quá mốc của ST-GNN: gb-risk-v2
    for i in out:
        assert i.lower_bound <= i.salinity <= i.upper_bound
        assert i.risk_salinity == 2.5 and i.model_version == "stgnn-daily-v2+gb-risk-v2"


def _loader(last_days):
    def load(codes):
        rows = []
        for code in codes:
            last = last_days.get(code, END)

// TODO: complete edge-case assertions and verification
