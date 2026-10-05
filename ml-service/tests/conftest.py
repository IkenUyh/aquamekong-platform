import fnmatch
import pytest


class FakeRedis:
    """Redis tối giản trong bộ nhớ cho test (get/set/delete/scan_iter)."""

    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self.store[key] = value

    def delete(self, key):
        self.store.pop(key, None)

    def scan_iter(self, pattern):
        return [k for k in list(self.store) if fnmatch.fnmatch(k, pattern)]


@pytest.fixture
def fake_redis(monkeypatch):
    r = FakeRedis()
    import app.services.predictor as predictor_module
    monkeypatch.setattr(predictor_module, "get_redis", lambda: r)
    return r
