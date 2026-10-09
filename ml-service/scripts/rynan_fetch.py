"""
Lấy độ mặn và mực nước cao nhất trong ngày của các trạm MEKONG RYNAN, ghi mỗi ngày một file
rynan_YYYY-MM-DD.csv (định dạng rynan_raw của app/ingest/parsers.py) và tải lên folder Google Drive.
GitHub Actions chạy script này mỗi sáng (.github/workflows/rynan-daily.yml).

    # Hôm qua (mặc định)
    python scripts/rynan_fetch.py --out out --upload
    # Lấy bù lần đầu: từ ngày dữ liệu cũ kết thúc đến hôm qua
    python scripts/rynan_fetch.py --from 2026-09-01 --to yesterday --out out --upload

Biến môi trường: RYNAN_USERNAME, RYNAN_PASSWORD (tài khoản app MEKONG RYNAN), RYNAN_BASE_URL (tuỳ chọn);
khi --upload thêm GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN (scripts/drive_auth.py), GDRIVE_FOLDER_ID.

Số liệu theo ngày lấy từ biểu đồ tab "Tháng" của app (GetChartAverageOfMonth, GetListDataChartAWDByMonth):
MaxSalinity / MaxWaterLevel trùng salinity_max / water_level_max của file features. Biểu đồ theo giờ chỉ
xem được 14 ngày gần nhất với tài khoản thường nên không dùng.

Repo công khai và log Actions ai cũng xem được: không in token hay số đo, chỉ in số trạm/số dòng.
"""

import argparse
import base64
import csv
import hashlib
import json
import os
import sys
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
DEFAULT_BASE_URL = "https://mktokenv2.rynanmobile.com"
APP_VERSION = "0.6.7"
CSV_COLUMNS = ["station_code", "station_name", "latitude", "longitude", "recorded_at", "metric", "value"]

TOKEN_URL = "https://oauth2.googleapis.com/token"
FILES_URL = "https://www.googleapis.com/drive/v3/files"
UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"


class RynanApiError(RuntimeError):
    pass


class DriveAuthError(RuntimeError):
    pass


# Mã lỗi của Google khi đổi refresh token (không chứa bí mật nên in ra log được)
DRIVE_AUTH_HINTS = {
    "invalid_client": "GDRIVE_CLIENT_ID hoặc GDRIVE_CLIENT_SECRET không khớp OAuth client: chép lại từ file JSON",
    "invalid_grant": "GDRIVE_REFRESH_TOKEN đã bị thu hồi, hết hạn hoặc thuộc OAuth client khác: chạy lại scripts/drive_auth.py",
}


def cryptojs_encrypt(plaintext: str, passphrase: str, salt: bytes = None) -> str:
    """
    Giống CryptoJS.AES.encrypt(chuỗi, passphrase) app dùng cho mật khẩu khi đăng nhập: AES-256-CBC, khoá + IV
    sinh từ passphrase bằng EVP_BytesToKey (MD5), kết quả là base64 của "Salted__" + salt + ciphertext.
    """
    from cryptography.hazmat.primitives import padding
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    salt = salt or os.urandom(8)
    derived, block = b"", b""
    while len(derived) < 48:
        block = hashlib.md5(block + passphrase.encode() + salt).digest()
        derived += block
    padder = padding.PKCS7(128).padder()
    data = padder.update(plaintext.encode()) + padder.finalize()
    encryptor = Cipher(algorithms.AES(derived[:32]), modes.CBC(derived[32:48])).encryptor()
    return base64.b64encode(b"Salted__" + salt + encryptor.update(data) + encryptor.finalize()).decode()


class RynanClient:
    """
    Gọi API của app MEKONG RYNAN bằng tài khoản thường. Nghỉ `delay` giây giữa các request
    để không dội tải server của Rynan.
    """

    def __init__(self, base_url: str, username: str, password: str, session=None, delay: float = 1.0,
                 retries: int = 3):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.session = session or requests.Session()
        self.delay = delay
        self.retries = retries
        self.token = None
        self.customer_code = None

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        for attempt in range(self.retries):
            time.sleep(self.delay * (2 ** attempt if attempt else 1))
            try:
                response = self.session.request(method, self.base_url + path, timeout=(10, 60), **kwargs)
            except requests.RequestException:
                if attempt == self.retries - 1:
                    raise
                continue
            # 4xx (sai mật khẩu, sai tham số) thử lại cũng vô ích
            if response.status_code < 500 or attempt == self.retries - 1:
                response.raise_for_status()
                return response
        raise AssertionError("unreachable")

    def api(self, name: str, **params) -> list:
        body = self.request("GET", f"/api/Mekong/{name}", params={"token": self.token, **params}).json()
        if not body.get("success") or body.get("errcode"):
            raise RynanApiError(f"{name}: {body.get('errcode')} {body.get('error') or ''}".strip())
        return body.get("data") or []

    def login(self) -> None:
        """Như LoginCustomer trong app (mekong/controller/login.js). Token hết hạn sau 24 giờ."""
        body = self.request("POST", "/api/LoginCustomer", data={
            "Username": self.username,
            # App mã hoá mật khẩu bằng ký tự thứ 2-4 của tên đăng nhập
            "Password": cryptojs_encrypt(self.password, self.username[1:4]),
            "AppCode": "MEKONG",
            "VersionApp": APP_VERSION,
            "deviceuuid": "aquamekong-fetch",
            "DeviceInfo": json.dumps({"DeviceID": "aquamekong-fetch", "DeviceIP": "192.168.0.1",
                                      "DeviceName": "aquamekong-fetch", "AppProject": "MEKONG"}),
        }).json()
        if not body.get("success") or not body.get("token"):
            raise RynanApiError(f"Đăng nhập thất bại: {body.get('errcode')} {body.get('error') or ''}".strip())
        self.token = body["token"]
        self.customer_code = body["data"]["data"]["CustomerCode"]

    def stations(self) -> list:
        """[{"code", "name", "latitude", "longitude", "awd"}, ...]; awd là mã cảm biến mực nước (có thể None)."""
        result = []
        for item in self.api("GetListDeviceShowByCustomer", CustomerCode=self.customer_code):
            node = item.get("_idSensorNode") or {}
            if not node.get("SensorNodeCode"):
                continue
            result.append({
                "code": node["SensorNodeCode"],
                "name": node.get("SNShortName") or "",
                "latitude": node.get("Latitude"),
                "longitude": node.get("Longitude"),
                "awd": item.get("IDAWD"),
            })
        return result

    def daily_max(self, station: dict, year: int, month: int) -> dict:
        """{ngày trong tháng: {"salinity": g/L, "water_level": cm}}, chỉ những giá trị có số đo."""
        days = {}
        for row in self.api("GetChartAverageOfMonth", SensorNodeCode=station["code"], Month=month, Year=year):
            if row.get("MaxSalinity") is not None:
                days.setdefault(int(row["Time"]), {})["salinity"] = row["MaxSalinity"]
        if station.get("awd"):
            groups = self.api("GetListDataChartAWDByMonth", ListIDAWD=json.dumps([station["awd"]]),
                              Month=month, Year=year)
            for row in (groups[0].get("data") or []) if groups else []:
                if row.get("MaxWaterLevel") is not None:
                    days.setdefault(int(row["Time"]), {})["water_level"] = row["MaxWaterLevel"]
        return days


def parse_day(value: str) -> date:
    today = datetime.now(TIMEZONE).date()
    if value == "yesterday":
        return today - timedelta(days=1)
    if value == "today":
        return today
    return date.fromisoformat(value)


def days_between(start: date, end: date) -> list:
    if start > end:
        raise ValueError(f"--from {start} sau --to {end}")
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def fetch_days(client: RynanClient, stations: list, days: list) -> dict:
    """{ngày: [dòng CSV]}. Mỗi trạm gọi API một lần cho mỗi tháng có trong `days`."""
    months = sorted({(d.year, d.month) for d in days})
    rows = {d: [] for d in days}
    for station in stations:
        for year, month in months:
            try:
                values = client.daily_max(station, year, month)
            except RynanApiError as e:
                # Một trạm lỗi không làm hỏng cả lần chạy
                print(f"Bỏ qua trạm {station['code']} tháng {month}/{year}: {e}", file=sys.stderr)
                continue
            for day_of_month, metrics in values.items():
                day = date(year, month, day_of_month)
                if day not in rows:
                    continue
                for metric, value in metrics.items():
                    rows[day].append({
                        "station_code": station["code"],
                        "station_name": station.get("name", ""),
                        "latitude": station.get("latitude", ""),
                        "longitude": station.get("longitude", ""),
                        "recorded_at": datetime(year, month, day_of_month, tzinfo=TIMEZONE).isoformat(),
                        "metric": metric,
                        "value": value,
                    })
    return rows


def write_csv(rows: list, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    return path


def drive_access_token(client_id: str, client_secret: str, refresh_token: str, session=requests) -> str:
    response = session.post(TOKEN_URL, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }, timeout=30)
    if response.status_code != 200:
        try:
            code = response.json().get("error", "")
        except ValueError:
            code = ""
        hint = DRIVE_AUTH_HINTS.get(code, "kiểm tra các secret GDRIVE_*")
        raise DriveAuthError(f"Google từ chối cấp quyền Drive ({response.status_code} {code}): {hint}")
    return response.json()["access_token"]


def upload_to_drive(path: Path, folder_id: str, token: str, session=requests) -> str:
    """Tải file lên folder; file cùng tên đã có thì ghi đè nội dung (chạy lại một ngày không tạo bản trùng)."""
    headers = {"Authorization": f"Bearer {token}"}
    response = session.get(FILES_URL, headers=headers, timeout=30, params={
        "q": f"name = '{path.name}' and '{folder_id}' in parents and trashed = false",
        "fields": "files(id)",
    })
    response.raise_for_status()
    existing = response.json().get("files", [])
    data = path.read_bytes()

    if existing:
        response = session.patch(f"{UPLOAD_URL}/{existing[0]['id']}", params={"uploadType": "media"},
                                 headers={**headers, "Content-Type": "text/csv"}, data=data, timeout=120)
    else:
        boundary = f"aquamekong-{uuid.uuid4().hex}"
        metadata = json.dumps({"name": path.name, "parents": [folder_id]})
        body = (
            f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n"
            f"--{boundary}\r\nContent-Type: text/csv\r\n\r\n"
        ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
        response = session.post(UPLOAD_URL, params={"uploadType": "multipart"}, data=body, timeout=120,
                                headers={**headers, "Content-Type": f"multipart/related; boundary={boundary}"})
    response.raise_for_status()
    return response.json()["id"]


def _env(name: str) -> str:
    # Secret dán vào GitHub hay dính khoảng trắng hoặc xuống dòng; giá trị GDRIVE_* chép từ file JSON
    # hay dính cả dấu ". Mật khẩu RYNAN thì giữ nguyên dấu nháy, vì có thể là một phần của mật khẩu.
    value = os.environ.get(name, "").strip()
    if name.startswith("GDRIVE_"):
        value = value.strip("\"'").strip()
    if not value:
        sys.exit(f"Thiếu biến môi trường {name}")
    return value


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Lấy số đo MEKONG RYNAN theo ngày, ghi CSV, tải lên Google Drive")
    parser.add_argument("--from", dest="start", default="yesterday", help="YYYY-MM-DD, 'yesterday' (mặc định)")
    parser.add_argument("--to", dest="end", default="yesterday", help="YYYY-MM-DD, 'yesterday' (mặc định)")
    parser.add_argument("--out", default="out", help="thư mục ghi CSV")
    parser.add_argument("--upload", action="store_true", help="tải từng file lên GDRIVE_FOLDER_ID")
    args = parser.parse_args(argv)

    days = days_between(parse_day(args.start), parse_day(args.end))
    client = RynanClient(os.environ.get("RYNAN_BASE_URL") or DEFAULT_BASE_URL,
                         _env("RYNAN_USERNAME"), _env("RYNAN_PASSWORD"))
    if args.upload:
        folder_id = _env("GDRIVE_FOLDER_ID")
        drive_creds = (_env("GDRIVE_CLIENT_ID"), _env("GDRIVE_CLIENT_SECRET"), _env("GDRIVE_REFRESH_TOKEN"))

        # Kiểm tra quyền Drive trước, để không mất nhiều phút lấy dữ liệu rồi mới báo lỗi
        drive_access_token(*drive_creds)

    client.login()
    stations = client.stations()
    print(f"{len(stations)} trạm, {len(days)} ngày ({days[0]} → {days[-1]})")

    by_day = fetch_days(client, stations, days)
    total = 0
    for day in days:
        rows = by_day[day]
        if not rows:
            print(f"{day}: không có số đo, bỏ qua")
            continue
        path = write_csv(rows, Path(args.out) / f"rynan_{day.isoformat()}.csv")
        if args.upload:
            # Token sống 1 giờ, lấy bù nhiều ngày có thể lâu hơn: lấy token mới cho mỗi file
            upload_to_drive(path, folder_id, drive_access_token(*drive_creds))
        total += len(rows)
        print(f"{day}: {len(rows)} dòng, {len({r['station_code'] for r in rows})} trạm")

    # Không có số đo nào cả: API đổi hoặc tài khoản hỏng, để Actions báo lỗi
    if total == 0:
        print("Không lấy được số đo nào", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
