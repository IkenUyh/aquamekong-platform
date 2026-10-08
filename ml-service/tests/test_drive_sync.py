from unittest.mock import MagicMock

import app.ingest.drive_sync as drive_sync
from tests.conftest import FakeRedis


class FakeResponse:
    def __init__(self, body=None, content=b""):
        self.body = body
        self.content = content

    def raise_for_status(self):
        pass

    def json(self):
        return self.body

    def iter_content(self, chunk_size):
        yield self.content

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


def _session(files):
    session = MagicMock()

    def get(url, params, **kwargs):
        if url == drive_sync.FILES_URL:
            return FakeResponse({"files": files})
        file_id = url.rsplit("/", 1)[1]
        return FakeResponse(content=f"noi dung {file_id}".encode())

    session.get.side_effect = get
    return session


def test_downloads_only_new_or_changed_rynan_files(tmp_path):
    redis = FakeRedis()
    redis.set("ingest:drive:old", "2026-10-05T23:10:00Z")
    redis.set("ingest:drive:rerun", "2026-10-05T23:10:00Z")
    files = [
        {"id": "old", "name": "rynan_2026-10-04.csv", "modifiedTime": "2026-10-05T23:10:00Z"},
        {"id": "rerun", "name": "rynan_2026-10-05.csv", "modifiedTime": "2026-10-06T23:10:00Z"},
        {"id": "new", "name": "rynan_2026-10-06.csv", "modifiedTime": "2026-10-06T23:10:00Z"},
        {"id": "other", "name": "ghi-chu.csv", "modifiedTime": "2026-10-06T23:10:00Z"},
    ]

    downloaded = drive_sync.sync_drive("folder", "key", tmp_path, redis, _session(files))

    assert downloaded == ["rynan_2026-10-05.csv", "rynan_2026-10-06.csv"]
    assert (tmp_path / "rynan_2026-10-06.csv").read_text() == "noi dung new"
    assert not list(tmp_path.glob("*.part"))
    assert redis.get("ingest:drive:new") == "2026-10-06T23:10:00Z"
    # Lần sau không tải lại
    assert drive_sync.sync_drive("folder", "key", tmp_path, redis, _session(files)) == []


def test_disabled_without_folder_or_key(tmp_path):
    session = MagicMock()
    assert drive_sync.sync_drive("", "key", tmp_path, FakeRedis(), session) == []
    assert drive_sync.sync_drive("folder", "", tmp_path, FakeRedis(), session) == []
    session.get.assert_not_called()


def test_redis_down_skips_the_run_instead_of_downloading_everything(tmp_path):
    redis = MagicMock()
    redis.get.side_effect = ConnectionError("redis down")
    files = [{"id": "new", "name": "rynan_2026-10-06.csv", "modifiedTime": "t"}]

    assert drive_sync.sync_drive("folder", "key", tmp_path, redis, _session(files)) == []
    assert not (tmp_path / "rynan_2026-10-06.csv").exists()
