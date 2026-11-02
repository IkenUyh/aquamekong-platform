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

// TODO: complete edge-case assertions and verification
