from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from app.early_warning import episodes as ep
from app.early_warning import service as svc
from app.early_warning.features import FEATURES, MAX_HORIZON, build_rows
from app.schemas.forecast import PredictionItem

D0 = date(2026, 1, 1)


def panel_from(values_by_station, start=D0, water=None):
    rows = []
    for sid, values in values_by_station.items():
        for i, v in enumerate(values):
            rows.append((sid, pd.Timestamp(start + timedelta(days=i)), v, None if water is None else water))
    return pd.DataFrame(rows, columns=["station_id", "day", "salinity", "water_level"]).astype(
        {"salinity": float, "water_level": float})


def seasonal_panel(first=date(2021, 11, 1), last=date(2023, 3, 31), stations=(87, 88)):
    """Độ mặn theo mùa (cao tháng 2–4), hai trạm, có nhiễu: đủ để học và chạy lại một mùa khô."""
    rng = np.random.default_rng(0)
    days = pd.date_range(first, last, freq="D")
    season = 3 * np.clip(np.sin(2 * np.pi * (days.dayofyear - 330) / 365), 0, None)
    rows = []
    for k, sid in enumerate(stations):
        salinity = np.clip(season * (1 + 0.3 * k) + rng.normal(0, 0.3, len(days)), 0, None)
        rows += [(sid, d, s, 1.0 + 0.1 * np.sin(i / 3)) for i, (d, s) in enumerate(zip(days, salinity))]
    return pd.DataFrame(rows, columns=["station_id", "day", "salinity", "water_level"])


# --- Đặc trưng ---------------------------------------------------------------------------------------------------

def test_features_of_an_issue_day_use_only_readings_before_it():
    values = [float(i) for i in range(60)]
    issue = pd.Timestamp(D0 + timedelta(days=40))
    rows = build_rows(panel_from({1: values}), max_horizon=3)
    changed = values[:40] + [99.0] * 20                          # đổi mọi số đo từ ngày phát hành trở đi
    rows2 = build_rows(panel_from({1: changed}), max_horizon=3)

    pick = lambda r: r[(r["issued"] == issue) & (r["h"] == 2)].iloc[0]
    a, b = pick(rows), pick(rows2)
    assert a["s0"] == 39.0                                       # số mới nhất là của ngày D-1
    features = [f for f in FEATURES if f not in ("ly_target",)]
    assert a[features].equals(b[features])
    assert a["target"] == 42.0 and b["target"] == 99.0           # mục tiêu là ngày D+2


def test_live_rows_are_issued_the_day_after_the_last_salinity_reading():
    values = [1.0] * 30 + [None, None]                           # 2 ngày cuối chỉ có mực nước
    rows = build_rows(panel_from({1: values}, water=1.0), live=True)

    assert set(rows["issued"]) == {pd.Timestamp(D0 + timedelta(days=30))}
    assert list(rows["h"]) == list(range(1, MAX_HORIZON + 1))
    assert rows["target"].isna().all()


# --- Mô phỏng cách app báo ---------------------------------------------------------------------------------------

def test_a_warning_stays_on_until_the_flagged_day_has_passed():
    # Sáng 1: dự báo ngày +3 có thể vượt 4‰; các sáng sau dự báo không còn thấy, số đo không vượt
    latest = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    risk = [[1.0] * 7, [1, 1, 5, 1, 1, 1, 1], [1.0] * 7, [1.0] * 7, [1.0] * 7, [1.0] * 7]
    periods = ep.simulate(D0, latest, risk, 4.0)

    assert len(periods) == 1
    p = periods[0]
    assert (p.start, p.first_risk_date, p.peak) == (D0 + timedelta(days=1), D0 + timedelta(days=4), 5)
    # Giữ tới hết ngày D0+4, sáng D0+5 mới báo hết nguy cơ: báo nhầm
    assert p.end == D0 + timedelta(days=5)
    assert p.outcome == "MISS"


def test_a_warning_is_a_hit_when_a_reading_above_the_threshold_arrives_during_it():
    latest = [1.0, 1.0, 1.0, 4.5, 4.2]
    risk = [[1, 5, 1, 1, 1, 1, 1], [1.0] * 7, [1.0] * 7, [1.0] * 7, [1.0] * 7]
    p = ep.simulate(D0, latest, risk, 4.0)[0]

    assert p.outcome == "HIT"
    assert p.confirmed == D0 + timedelta(days=3)
    assert p.to_json()["end"] == (D0 + timedelta(days=3)).isoformat()


def test_days_without_a_forecast_keep_the_state():
    latest = [1.0, None, None, 1.0]
    risk = [[5, 1, 1, 1, 1, 1, 1], None, None, [1.0] * 7]
    p = ep.simulate(D0, latest, risk, 4.0)[0]
    assert p.end == D0 + timedelta(days=3)


def test_score_counts_onsets_covered_by_a_warning_and_wrong_warnings():
    # Ngày 0..9: dưới ngưỡng tới ngày 5, vượt ngày 5 (số về sáng 6)
    daily = {D0 + timedelta(days=i): v for i, v in enumerate([1, 1, 1, 1, 1, 5, 5, 1, 1, 1])}
    latest = [None] + [daily[D0 + timedelta(days=i - 1)] for i in range(1, 10)]
    risk = [None] + [[1.0] * 7] * 9
    risk[2] = [1, 1, 5, 1, 1, 1, 1]                               # sáng ngày 2: có thể vượt ngày 5
    periods = ep.simulate(D0, latest, risk, 4.0)
    result = ep.score(periods, ep.onsets(daily, 4.0, D0, D0 + timedelta(days=9)))

    assert result["onsets"] == 1 and result["covered"] == 1
    assert result["leads"] == [3]                                 # báo sáng ngày 2 cho lần vượt ngày 5
    assert (result["warnings"], result["hits"], result["misses"]) == (1, 1, 0)


def test_without_risk_levels_the_app_never_warns_before_an_onset():
    # Chỉ giữ nguyên số mới nhất (không có mô hình rủi ro): vượt rồi giảm thì báo hết mặn ngay, lần vượt sau bất ngờ
    daily = {D0 + timedelta(days=i): v for i, v in enumerate([1, 1, 1, 5, 5, 1, 1, 5])}
    latest = [None] + [daily[D0 + timedelta(days=i - 1)] for i in range(1, 8)]
    risk = [None] + [[None] * 7] * 7
    periods = ep.simulate(D0, latest, risk, 4.0)
    result = ep.score(periods, ep.onsets(daily, 4.0, D0, D0 + timedelta(days=7)))

    assert [(p.start, p.end, p.early) for p in periods] == [(D0 + timedelta(days=4), D0 + timedelta(days=6), False)]
    assert result["onsets"] == 2
    assert result["covered"] == 0 and result["warnings"] == 0


def test_risk_keeps_a_period_open_through_a_dip():
    # Đã vượt; giảm 2 ngày nhưng mô hình thấy có thể vượt lại: không báo hết mặn, lần vượt sau đã được cảnh báo
    daily = {D0 + timedelta(days=i): v for i, v in enumerate([1, 5, 2, 2, 5])}
    latest = [None] + [daily[D0 + timedelta(days=i - 1)] for i in range(1, 5)]
    risk = [None, [1] * 7, [1] * 7, [1] * 7, [1] * 7]
    risk[3] = [5] + [1] * 6                                       # sáng ngày 3: có thể vượt ngày 4
    periods = ep.simulate(D0, latest, risk, 4.0)
    result = ep.score(periods, ep.onsets(daily, 4.0, D0, D0 + timedelta(days=4)))

    assert result["onsets"] == 2 and result["covered"] == 1       # lần vượt ngày 4
    assert result["warnings"] == 0                                # đợt bắt đầu từ lần vượt thật, không phải báo sớm


# --- Mùa khô chạy lại --------------------------------------------------------------------------------------------

def test_dry_seasons_need_a_year_of_history_and_stop_at_the_last_day():
    seasons = svc.dry_seasons(date(2021, 8, 31), date(2026, 1, 15))
    assert [(s, e) for _, s, e in seasons] == [
        (date(2022, 12, 1), date(2023, 5, 31)),
        (date(2023, 12, 1), date(2024, 5, 31)),
        (date(2024, 12, 1), date(2025, 5, 31)),
        (date(2025, 12, 1), date(2026, 1, 15)),
    ]


@pytest.fixture(scope="module")
def trained():
    panel = seasonal_panel()
    model, meta, backtest = svc.train_all(panel, data_version=7)
    return panel, model, meta, backtest


def test_train_all_scores_each_dry_season_on_a_model_that_only_saw_earlier_data(trained):
    _, _, meta, backtest = trained
    assert [s["label"] for s in meta["seasons"]] == ["Mùa khô 2022–2023"]
    season = meta["seasons"][0]
    assert season["trainedUntil"] == "2022-11-30"
    assert [t["threshold"] for t in season["thresholds"]] == list(svc.THRESHOLDS)
    grid = backtest["seasons"][0]["stations"]["87"]
    assert len(grid["latest"]) == len(grid["risk"]) == (date(2023, 3, 31) - date(2022, 12, 1)).days + 1
    assert all(len(r) == ep.WARNING_HORIZON for r in grid["risk"] if r is not None)


@pytest.fixture
def service(trained, tmp_path, monkeypatch):
    panel, model, meta, backtest = trained
    s = svc.EarlyWarningService(model_dir=str(tmp_path))
    s._save(model, meta, backtest)
    monkeypatch.setattr(svc, "load_panel", lambda: panel)
    monkeypatch.setattr(svc.data_loader, "latest_measurement_id", lambda: 7)
    return s


def test_forecast_holds_the_latest_reading_with_a_band_and_a_risk_level(service):
    today = date(2023, 4, 1)                                      # số đo cuối 31/03
    items = service.forecast(87, 7, today)

    assert [i.date for i in items] == [today + timedelta(days=k) for k in range(1, 8)]
    assert len({i.salinity for i in items}) == 1
    for i in items:
        assert i.lower_bound <= i.salinity <= i.upper_bound
        assert i.risk_salinity == i.upper_bound
        assert i.model_version == svc.MODEL_VERSION


def test_forecast_gives_up_when_readings_are_stale_or_the_station_is_unknown(service):
    assert service.forecast(87, 7, date(2023, 4, 4)) is None      # số đo cuối cách 4 ngày
    assert service.forecast(999, 7, date(2023, 4, 1)) is None
    assert service.forecast(87, 30, date(2023, 4, 1)) is None     # xa hơn số ngày mô hình đã học


def test_saved_model_is_loaded_by_a_new_service(service, tmp_path):
    fresh = svc.EarlyWarningService(model_dir=str(tmp_path))
    assert fresh.stamp() == service.stamp() != "none"
    assert fresh.evaluation()["seasons"][0]["label"] == "Mùa khô 2022–2023"


def test_replay_episodes_use_each_station_threshold_and_the_requested_range(service):
    result = service.replay_episodes(date(2022, 12, 1), date(2023, 3, 31), {87: 0.5})
    assert result["available"] and result["seasons"][0]["from"] == "2022-12-01"
    assert set(result["stations"]) <= {"87"}

    outside = service.replay_episodes(date(2021, 12, 1), date(2022, 3, 31), {87: 0.5, 88: 0.5})
    assert outside["seasons"] == [] and outside["stations"] == {}


def test_replay_without_a_trained_model_is_marked_unavailable(tmp_path):
    result = svc.EarlyWarningService(model_dir=str(tmp_path)).replay_episodes(D0, D0, {1: 4.0})
    assert result == {"available": False, "seasons": [], "stations": {}}


# --- Predictor ---------------------------------------------------------------------------------------------------

def test_predictor_prefers_the_risk_model_over_holding_the_latest_reading(monkeypatch):
    import app.services.predictor as predictor_module

    item = PredictionItem(date=D0, salinity=1.0, upper_bound=2.0, risk_salinity=2.0, model_version=svc.MODEL_VERSION)
    monkeypatch.setattr(predictor_module.Predictor, "_stgnn_forecast", lambda self, sid, days: None)
    monkeypatch.setattr(predictor_module.early_warning, "forecast", lambda sid, days: [item])

    assert predictor_module.Predictor()._predict_uncached(1, 7) == [item]


def test_predictor_falls_back_when_the_risk_model_fails(monkeypatch):
    import app.services.predictor as predictor_module

    def boom(sid, days):
        raise RuntimeError("hỏng")

    index = pd.date_range("2026-01-01", periods=10, freq="D", tz="Asia/Ho_Chi_Minh")
    monkeypatch.setattr(predictor_module.Predictor, "_stgnn_forecast", lambda self, sid, days: None)
    monkeypatch.setattr(predictor_module.early_warning, "forecast", boom)
    monkeypatch.setattr(predictor_module, "load_station_metrics",
                        lambda station_id, lookback_days: pd.DataFrame({"salinity": [2.0] * 10}, index=index))
    p = predictor_module.Predictor()
    monkeypatch.setattr(p.prophet, "has_trained_model", lambda sid: False)
    monkeypatch.setattr(p.model, "has_trained_model", lambda sid: False)

    items = p._predict_uncached(1, 3)
    assert {i.model_version for i in items} == {predictor_module.STATISTICAL_VERSION}
    assert all(i.risk_salinity is None for i in items)
