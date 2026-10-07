"""
Tải file rynan_YYYY-MM-DD.csv mới từ folder Google Drive (GDRIVE_FOLDER_ID) vào thư mục inbox.
GitHub Actions (.github/workflows/rynan-daily.yml) tải file lên folder mỗi ngày; job inbox nạp vào DB.
Folder phải đặt quyền "Bất kỳ ai có đường liên kết" vì job đọc bằng API key, không đăng nhập.
"""

import logging
import os
import re
from pathlib import Path

import requests

from app.cache import get_redis
from app.config import get_settings

logger = logging.getLogger(__name__)

FILES_URL = "https://www.googleapis.com/drive/v3/files"
NAME_PATTERN = re.compile(r"^rynan_\d{4}-\d{2}-\d{2}\.csv$")
# ingest:drive:<file id> = modifiedTime đã tải; file bị ghi đè trên Drive (chạy lại ngày đó) thì tải lại
DONE_KEY = "ingest:drive:{}"


def list_files(folder_id: str, api_key: str, session=requests) -> list:
    files, page_token = [], None
    while True:
        params = {
            "q": f"'{folder_id}' in parents and trashed = false",
            "fields": "nextPageToken, files(id, name, modifiedTime)",
            "pageSize": 1000,
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token
        response = session.get(FILES_URL, params=params, timeout=(10, 60))
        response.raise_for_status()
        body = response.json()
        files.extend(body.get("files", []))
        page_token = body.get("nextPageToken")
        if not page_token:
            return files


def download(file: dict, api_key: str, inbox: Path, session=requests) -> Path:
    # Ghi ra .part rồi đổi tên: job inbox chỉ nhận .csv nên không bao giờ đọc file đang tải dở
    target = inbox / file["name"]
    part = target.with_name(target.name + ".part")
    with session.get(f"{FILES_URL}/{file['id']}", params={"alt": "media", "key": api_key},
                     stream=True, timeout=(10, 300)) as response:
        response.raise_for_status()
        with open(part, "wb") as f:
            for chunk in response.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    os.replace(part, target)
    return target


def sync_drive(folder_id=None, api_key=None, inbox_dir=None, redis_client=None, session=requests) -> list:
    """Trả về tên các file vừa tải vào inbox."""
    settings = get_settings()
    folder_id = folder_id if folder_id is not None else settings.gdrive_folder_id
    api_key = api_key if api_key is not None else settings.gdrive_api_key
    if not folder_id or not api_key:
        return []

    inbox = Path(inbox_dir or settings.ingest_inbox_dir)
    inbox.mkdir(parents=True, exist_ok=True)
    redis_client = redis_client or get_redis()

    try:
        files = [f for f in list_files(folder_id, api_key, session) if NAME_PATTERN.match(f["name"])]
        done = {f["id"]: redis_client.get(DONE_KEY.format(f["id"])) for f in files}
    except Exception as e:
        # Redis hỏng mà vẫn chạy thì lần nào cũng tải lại cả folder; đợi lần sau
        logger.error(f"Không đọc được folder Google Drive hoặc Redis: {e}")
        return []

    downloaded = []
    for file in sorted(files, key=lambda f: f["name"]):
        if done[file["id"]] == file["modifiedTime"]:
            continue
        try:
            download(file, api_key, inbox, session)
            redis_client.set(DONE_KEY.format(file["id"]), file["modifiedTime"])
            downloaded.append(file["name"])
        except Exception as e:
            logger.error(f"Tải {file['name']} từ Google Drive thất bại: {e}")
    if downloaded:
        logger.info(f"Đã tải {len(downloaded)} file từ Google Drive vào inbox: {downloaded}")
    return downloaded
