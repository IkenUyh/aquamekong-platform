import fnmatch
import os
import tempfile

import pytest

# Mặc định model_dir/features_dir là /app/... (đường dẫn trong container): khi chạy test ngoài Docker
# (máy dev, CI) thì trỏ sang thư mục tạm, trước khi app import get_settings()
os.environ.setdefault("MODEL_DIR", tempfile.mkdtemp(prefix="aquamekong-models-"))
os.environ.setdefault("FEATURES_DIR", tempfile.mkdtemp(prefix="aquamekong-features-"))


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
    # Phiên bản dữ liệu của cache dự báo; test đổi giá trị này để giả lập số đo mới
    r.data_version = 1
    monkeypatch.setattr(predictor_module, "latest_measurement_id", lambda: r.data_version)
    return r
