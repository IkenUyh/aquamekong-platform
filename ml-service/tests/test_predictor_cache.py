import pytest
from datetime import date, timedelta

from app.schemas.forecast import PredictionItem
from app.services.predictor import Predictor


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


def test_simulated_predictions_are_not_cached(fake_redis, monkeypatch):
    p = Predictor()
    calls = []
    monkeypatch.setattr(p, "_predict_uncached", lambda s, d: calls.append(s) or _items("simulated-v1.0"))

    p.predict(1, 3)
    p.predict(1, 3)

    assert calls == [1, 1]


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

    end = date(2026, 8, 31)
    graph = GraphForecast(end, {"A1": [StationForecast(1, end + timedelta(days=1), 0.2, 0.3, 0.5),
                                       StationForecast(7, end + timedelta(days=7), 0.1, 0.4, 0.9)]})
    monkeypatch.setattr(predictor_module, "load_station_info", lambda sid: {"code": "A1"})
    monkeypatch.setattr(predictor_module.stgnn_forecaster, "forecast", lambda code, days: graph)
    monkeypatch.setattr(predictor_module.stgnn_forecaster, "meta", lambda: {"model_version": "st-gnn-v1"})
    p = Predictor()
    monkeypatch.setattr(p.prophet, "has_trained_model", lambda s: pytest.fail("không được tới Prophet khi ST-GNN dùng được"))

    items = p._predict_uncached(1, 7)

    assert [(i.date, i.salinity, i.lower_bound, i.upper_bound) for i in items] == [
        (date(2026, 9, 1), 0.3, 0.2, 0.5), (date(2026, 9, 7), 0.4, 0.1, 0.9)]
    assert {i.model_version for i in items} == {"st-gnn-v1"} and items[0].data_end == end


def test_falls_back_when_stgnn_cannot_serve_the_station(monkeypatch):
    import app.services.predictor as predictor_module

    monkeypatch.setattr(predictor_module, "load_station_info", lambda sid: {"code": "OTHER"})
    monkeypatch.setattr(predictor_module.stgnn_forecaster, "forecast", lambda code, days: None)
    p = Predictor()
    monkeypatch.setattr(p.prophet, "has_trained_model", lambda s: True)
    monkeypatch.setattr(p.prophet, "predict", lambda s, d: _items("prophet-v1.0"))

    assert p._predict_uncached(1, 7)[0].model_version == "prophet-v1.0"
