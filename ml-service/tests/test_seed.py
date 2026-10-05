from unittest.mock import MagicMock

import pytest

import app.ingest.seed as seed


def test_drive_share_link_becomes_direct_download():
    url = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing"
    assert seed.to_download_url(url) == (
        "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&export=download&confirm=t"
    )
    assert seed.to_download_url("https://example.com/data.csv") == "https://example.com/data.csv"


def _engine(has_data):
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.scalar.return_value = has_data
    return engine


def test_seed_skips_when_real_data_exists(monkeypatch):
    monkeypatch.setattr(seed, "download", lambda *a: pytest.fail("không được tải khi DB đã có dữ liệu"))

    assert seed.seed_if_empty("https://drive.google.com/file/d/x/view", engine=_engine(True)) is None


def test_seed_imports_downloaded_file_when_db_is_empty(monkeypatch, tmp_path):
    monkeypatch.setattr(seed, "download", lambda url, target: tmp_path / "data.csv")
    imported = []
    monkeypatch.setattr(seed, "import_file", lambda path, engine: imported.append(path.name) or "report")

    assert seed.seed_if_empty("https://example.com/data.csv", engine=_engine(False)) == "report"
    assert imported == ["data.csv"]


def test_drive_link_without_public_sharing_gives_clear_error(monkeypatch, tmp_path):
    response = MagicMock()
    response.headers = {"Content-Type": "text/html; charset=utf-8"}
    response.__enter__.return_value = response
    monkeypatch.setattr(seed.requests, "get", lambda *a, **k: response)

    with pytest.raises(RuntimeError, match="Bất kỳ ai có đường liên kết"):
        seed.download("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view", tmp_path)
