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
