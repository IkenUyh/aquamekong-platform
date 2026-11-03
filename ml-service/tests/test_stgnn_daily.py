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
            for d in pd.date_range(END - timedelta(days=70), last, freq="D"):
                rows.append((code, d, 0.5 + 0.1 * np.sin(d.dayofyear / 5), 120.0 + 5 * np.cos(d.dayofyear / 3)))
        return pd.DataFrame(rows, columns=["code", "day", "salinity", "water_level"])
    return load


def test_the_installed_weights_forecast_every_station_for_eight_days():
    f = DailyForecaster(loader=_loader({}))
    graph = f.graph(END + timedelta(days=1))

    assert graph.data_end == END
    for code in META["stations"]:
        fcs = graph.by_station[code]
        assert [x.horizon for x in fcs] == list(range(1, 9))
        assert [x.date for x in fcs] == [END + timedelta(days=h) for h in range(1, 9)]
        assert all(0 <= x.q10 <= x.q50 <= x.q90 for x in fcs)


def test_a_station_that_went_silent_or_old_data_gets_no_stgnn_forecast():
    silent = META["stations"][0]
    f = DailyForecaster(loader=_loader({silent: END - timedelta(days=10)}))
    today = END + timedelta(days=1)
    assert f.forecast(silent, today) is None
    assert f.forecast(META["stations"][1], today) is not None
    assert f.forecast("NOT_IN_GRAPH", today) is None
    assert DailyForecaster(loader=_loader({})).forecast(META["stations"][1], END + timedelta(days=daily.MAX_DATA_AGE_DAYS + 1)) is None


def test_predictor_keeps_the_risk_model_when_stgnn_daily_fails(monkeypatch):
    import app.services.predictor as predictor_module

    risk = [PredictionItem(date=END + timedelta(days=1), salinity=2.0, model_version="gb-risk-v2")]
    monkeypatch.setattr(predictor_module, "load_station_info", lambda sid: {"code": META["stations"][0]})
    monkeypatch.setattr(predictor_module, "latest_measurement_id", lambda: 1)

    def boom(*args, **kwargs):
        raise RuntimeError("hỏng")

    monkeypatch.setattr(predictor_module.daily_forecaster, "forecast", boom)
    assert predictor_module.Predictor._with_stgnn_daily(1, risk) == risk
