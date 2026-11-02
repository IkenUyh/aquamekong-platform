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

// TODO: complete edge-case assertions and verification
