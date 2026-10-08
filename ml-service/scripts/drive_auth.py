"""
Chạy MỘT LẦN trên laptop để lấy refresh token Google Drive cho scripts/rynan_fetch.py --upload.

    GDRIVE_CLIENT_ID=... GDRIVE_CLIENT_SECRET=... python scripts/drive_auth.py

Mở link in ra, đăng nhập bằng tài khoản Google sở hữu folder, đồng ý; script in refresh token để dán
vào GitHub Secret GDRIVE_REFRESH_TOKEN. Không lưu token vào file, không commit.

Cần scope drive (không phải drive.file) vì folder đích không do app này tạo ra.
OAuth client phải là loại "Desktop app", và màn hình đồng ý phải ở trạng thái "In production":
ở trạng thái "Testing", Google huỷ refresh token sau 7 ngày.
"""

import os
import secrets
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

import requests

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/drive"


def main() -> int:
    client_id = os.environ.get("GDRIVE_CLIENT_ID")
    client_secret = os.environ.get("GDRIVE_CLIENT_SECRET")
    if not client_id or not client_secret:
        sys.exit("Cần GDRIVE_CLIENT_ID và GDRIVE_CLIENT_SECRET (OAuth client loại Desktop app)")

    state = secrets.token_urlsafe(16)
    result = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            query = parse_qs(urlparse(self.path).query)
            if query.get("state", [None])[0] == state:
                result.update({k: v[0] for k, v in query.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("Xong, quay lại terminal.".encode())

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    print("Mở link này trong trình duyệt:\n")
    print(AUTH_URL + "?" + urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }) + "\n")
    while not result:
        server.handle_request()

    if "code" not in result:
        sys.exit(f"Google trả về lỗi: {result.get('error', 'không rõ')}")
    response = requests.post(TOKEN_URL, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "code": result["code"],
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }, timeout=30)
    response.raise_for_status()
    print("GDRIVE_REFRESH_TOKEN =", response.json()["refresh_token"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
