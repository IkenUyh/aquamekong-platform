from datetime import date, timedelta

import pandas as pd
import pytest

from app.evaluation import accuracy as acc
from app.schemas.forecast import PredictionItem

START = date(2026, 6, 1)


def daily(values, start=START):
    return pd.Series([float(v) for v in values], index=[start + timedelta(days=i) for i in range(len(values))])


def test_issue_day_sees_only_data_before_it():
    seen = []

    def spy(history, days_ahead, today):
        seen.append((today, history.index[-1]))
        return [PredictionItem(date=today + timedelta(days=i), salinity=0.0) for i in range(1, days_ahead + 1)]

    acc.backtest({1: daily(range(30))}, START + timedelta(days=10), START + timedelta(days=12), forecaster=spy)

    # Phát hành ngày D chỉ thấy số đo tới hết D-1, như job 07:30 khi số đo của D về sáng D+1
    assert seen == [(START + timedelta(days=d), START + timedelta(days=d - 1)) for d in (10, 11, 12)]


def test_pairs_each_lead_with_the_actual_reading_and_persistence():
    series = daily([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    def constant(history, days_ahead, today):
        return [PredictionItem(date=today + timedelta(days=i), salinity=5.0) for i in range(1, days_ahead + 1)]

    df = acc.backtest({1: series}, START + timedelta(days=4), START + timedelta(days=4), forecaster=constant)

    # Phát hành 05/06: số mới nhất là 04/06 (= 4), dự báo 06/06..12/06 có số thật 6..12
    assert list(df["lead"]) == [1, 2, 3, 4, 5, 6, 7]
    assert list(df["actual"]) == [6, 7, 8, 9, 10, 11, 12]
    assert set(df["persistence"]) == {4.0}


def test_missing_actual_days_are_skipped_and_short_history_is_not_forecast():
    series = daily([1, 1, 1, 1, 1]).drop(START + timedelta(days=4))
    df = acc.backtest({1: series}, START + timedelta(days=1), START + timedelta(days=3))
    # Thống kê cần 3 ngày: phát hành 02/06, 03/06 thiếu dữ liệu; 04/06 dự báo 05/06 trở đi nhưng 05/06 không có số thật
    assert df.empty


def test_summary_compares_with_persistence_and_counts_salinity_levels():
    df = pd.DataFrame([
        (1, START, 1, START + timedelta(days=1), 3.5, 3.0, 4.5),
        (1, START, 1, START + timedelta(days=2), 0.8, 0.5, 0.9),
        (2, START, 3, START + timedelta(days=3), 2.0, 2.0, 2.4),
    ], columns=["station_id", "issued", "lead", "date", "predicted", "persistence", "actual"])

    summary = acc.summarize(df, START, START + timedelta(days=3), "statistical-v1.1")

    lead1 = summary["byLead"][0]
    assert lead1 == {"lead": 1, "count": 2, "mae": pytest.approx(0.55), "persistenceMae": pytest.approx(0.95),
                     "levelAccuracy": 0.5}
    station2 = next(s for s in summary["stations"] if s["stationId"] == 2)
    assert station2["series"] == [{"date": (START + timedelta(days=3)).isoformat(), "actual": 2.4, "predicted": 2.0}]


def test_salinity_levels_match_the_map():
    assert [acc.salinity_class(v) for v in (0.5, 1.0, 4.0, 4.1)] == [0, 1, 1, 2]


def test_result_is_cached_for_the_day(monkeypatch, fake_redis):
    calls = []
    monkeypatch.setattr(acc, "get_redis", lambda: fake_redis)
    monkeypatch.setattr(acc, "load_daily_salinity", lambda since: calls.append(since) or {1: daily([1] * 400, START - timedelta(days=300))})

    first = acc.accuracy(30)
    second = acc.accuracy(30)

    assert first == second
    assert len(calls) == 1
