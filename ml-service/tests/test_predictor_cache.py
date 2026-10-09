import pandas as pd
import pytest
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.schemas.forecast import PredictionItem
from app.services.predictor import Predictor

VN = ZoneInfo("Asia/Ho_Chi_Minh")


def _items(version):
    return [PredictionItem(date=date.today() + timedelta(days=1), salinity=2.5, model_version=version)]


def test_real_predictions_are_cached(fake_redis, monkeypatch):
    p = Predictor()
    calls = []
    monkeypatch.setattr(p, "_predict_uncached", lambda s, d: calls.append(s) or _items("statistical-v1.0"))

    first = p.predict(1, 3)
    second = p.predict(1, 3)

    assert calls == [1]  # lần 2 lấy từ cache
    assert second == first


def test_no_forecast_is_invented_without_recent_measurements(monkeypatch):
    import app.services.predictor as predictor_module
    from app.services.predictor import InsufficientDataError

    monkeypatch.setattr(predictor_module.stgnn_forecaster, "forecast", lambda code, days: None)
    monkeypatch.setattr(predictor_module, "load_station_info", lambda sid: {"code": "X"})
    monkeypatch.setattr(predictor_module, "load_station_metrics", lambda sid, lookback_days: pd.DataFrame())
    p = Predictor()
    monkeypatch.setattr(p.prophet, "has_trained_model", lambda s: False)
    monkeypatch.setattr(p.model, "has_trained_model", lambda s: False)

    with pytest.raises(InsufficientDataError):
        p._predict_uncached(1, 7)


def _daily(values, last_day):
    index = pd.DatetimeIndex([pd.Timestamp(last_day - timedelta(days=len(values) - 1 - i), tz=VN) for i in range(len(values))])
    return pd.DataFrame({"salinity": values}, index=index)


def test_statistical_forecast_starts_tomorrow_from_the_recent_level():
    today = date(2026, 10, 9)
    # Tháng trước mặn 3‰, 14 ngày gần đây đứng yên quanh 0,5‰: không được bị kéo lên bởi số cũ
    df = _daily([3.0] * 30 + [0.5] * 14, today - timedelta(days=2))

    items = Predictor._statistical_forecast(df, 3, today=today)

    assert [i.date for i in items] == [date(2026, 10, 10), date(2026, 10, 11), date(2026, 10, 12)]
    assert all(abs(i.salinity - 0.5) < 0.01 for i in items)


def test_statistical_forecast_keeps_the_latest_reading_instead_of_extrapolating():
    today = date(2026, 10, 9)
    df = _daily([1.0, 1.1, 1.2, 1.3, 1.4], today - timedelta(days=1))   # đang tăng 0,1‰/ngày, số cuối 1,4

    items = Predictor._statistical_forecast(df, 3, today=today)

    # Backtest 360 ngày: kéo dài xu hướng sai nhiều hơn giữ nguyên số mới nhất ở mọi số ngày dự báo trước
    assert [i.salinity for i in items] == [1.4, 1.4, 1.4]
    assert items[0].model_version == "statistical-v2"


def test_statistical_forecast_band_widens_with_the_days_ahead():
    today = date(2026, 10, 9)
    df = _daily([1.0, 1.3, 0.9, 1.4, 1.1, 1.2], today - timedelta(days=1))

    items = Predictor._statistical_forecast(df, 7, today=today)

    widths = [i.upper_bound - i.lower_bound for i in items]
    assert widths == sorted(widths) and widths[0] < widths[-1]
    assert all(i.lower_bound >= 0 for i in items)


def test_statistical_forecast_needs_a_few_days_of_data():
    from app.services.predictor import InsufficientDataError

    with pytest.raises(InsufficientDataError):
        Predictor._statistical_forecast(_daily([1.0, 1.2], date(2026, 10, 8)), 3, today=date(2026, 10, 9))


def test_invalidate_clears_only_that_station(fake_redis, monkeypatch):
    p = Predictor()
    monkeypatch.setattr(p, "_predict_uncached", lambda s, d: _items("statistical-v1.0"))
    p.predict(1, 3)
    p.predict(2, 3)

    p.invalidate(1)

    assert p._get_cached(p._cache_key(1, 3)) is None
    assert p._get_cached(p._cache_key(2, 3)) is not None


def test_redis_down_does_not_break_prediction(monkeypatch):
    import app.services.predictor as predictor_module

    def broken():
        raise ConnectionError("redis down")

    monkeypatch.setattr(predictor_module, "get_redis", broken)
    p = Predictor()
    monkeypatch.setattr(p, "_predict_uncached", lambda s, d: _items("statistical-v1.0"))

    assert p.predict(1, 3)[0].salinity == 2.5


def test_stgnn_is_tried_first_and_carries_its_data_end(monkeypatch):
    import app.services.predictor as predictor_module
    from app.stgnn.forecaster import GraphForecast, StationForecast

    end = datetime.now(VN).date() - timedelta(days=1)
    graph = GraphForecast(end, {"A1": [StationForecast(1, end + timedelta(days=1), 0.2, 0.3, 0.5),
                                       StationForecast(7, end + timedelta(days=7), 0.1, 0.4, 0.9)]})
    monkeypatch.setattr(predictor_module, "load_station_info", lambda sid: {"code": "A1"})
    monkeypatch.setattr(predictor_module.stgnn_forecaster, "forecast", lambda code, days: graph)
    monkeypatch.setattr(predictor_module.stgnn_forecaster, "meta", lambda: {"model_version": "st-gnn-v1"})
    p = Predictor()
    monkeypatch.setattr(p.prophet, "has_trained_model", lambda s: pytest.fail("không được tới Prophet khi ST-GNN dùng được"))

    items = p._predict_uncached(1, 7)

    assert [(i.date, i.salinity, i.lower_bound, i.upper_bound) for i in items] == [
        (end + timedelta(days=1), 0.3, 0.2, 0.5), (end + timedelta(days=7), 0.4, 0.1, 0.9)]
    assert {i.model_version for i in items} == {"st-gnn-v1"} and items[0].data_end == end


def test_falls_back_when_stgnn_cannot_serve_the_station(monkeypatch):
    import app.services.predictor as predictor_module

    monkeypatch.setattr(predictor_module, "load_station_info", lambda sid: {"code": "OTHER"})
    monkeypatch.setattr(predictor_module.stgnn_forecaster, "forecast", lambda code, days: None)
    p = Predictor()
    monkeypatch.setattr(p.prophet, "has_trained_model", lambda s: True)
    monkeypatch.setattr(p.prophet, "predict", lambda s, d: _items("prophet-v1.0"))

    assert p._predict_uncached(1, 7)[0].model_version == "prophet-v1.0"


def test_stale_stgnn_gives_way_to_other_models(monkeypatch):
    import app.services.predictor as predictor_module
    from app.stgnn.forecaster import GraphForecast, StationForecast

    end = datetime.now(VN).date() - timedelta(days=30)   # kho feature dừng 30 ngày trước
    graph = GraphForecast(end, {"A1": [StationForecast(1, end + timedelta(days=1), 0.2, 0.3, 0.5)]})
    monkeypatch.setattr(predictor_module, "load_station_info", lambda sid: {"code": "A1"})
    monkeypatch.setattr(predictor_module.stgnn_forecaster, "forecast", lambda code, days: graph)
    p = Predictor()
    monkeypatch.setattr(p.prophet, "has_trained_model", lambda s: True)
    monkeypatch.setattr(p.prophet, "predict", lambda s, d: _items("prophet-v1.0"))

    assert p._predict_uncached(1, 7)[0].model_version == "prophet-v1.0"
