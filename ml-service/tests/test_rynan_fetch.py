import csv
import importlib.util
import json
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.ingest.parsers import parse_file

_spec = importlib.util.spec_from_file_location(
    "rynan_fetch", Path(__file__).resolve().parents[1] / "scripts" / "rynan_fetch.py")
rynan_fetch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rynan_fetch)

STATION = {"code": "A001", "name": "Trạm A", "latitude": 9.5, "longitude": 105.2, "awd": "WLS1"}


class FakeClient:
    """daily_max theo (năm, tháng); đếm số lần gọi để kiểm tra mỗi tháng chỉ gọi một lần."""

    def __init__(self, months):
        self.months = months
        self.calls = []

    def login(self):
        pass

    def stations(self):
        return [STATION]

    def daily_max(self, station, year, month):
        self.calls.append((station["code"], year, month))
        return self.months.get((year, month), {})


def _env(monkeypatch):
    for name in ("RYNAN_USERNAME", "RYNAN_PASSWORD"):
        monkeypatch.setenv(name, "x")


def test_backfill_range_includes_both_ends():
    days = rynan_fetch.days_between(date(2026, 8, 31), date(2026, 9, 2))
    assert days == [date(2026, 8, 31), date(2026, 9, 1), date(2026, 9, 2)]
    with pytest.raises(ValueError):
        rynan_fetch.days_between(date(2026, 9, 2), date(2026, 9, 1))


def test_fetch_days_calls_each_month_once_and_keeps_only_requested_days():
    client = FakeClient({
        (2026, 8): {30: {"salinity": 0.13}, 31: {"salinity": 0.12, "water_level": 174}},
        (2026, 9): {1: {"salinity": 0.12}, 2: {"salinity": 0.15}},
    })

    rows = rynan_fetch.fetch_days(client, [STATION], [date(2026, 8, 31), date(2026, 9, 1)])

    assert client.calls == [("A001", 2026, 8), ("A001", 2026, 9)]
    assert {(r["metric"], r["value"]) for r in rows[date(2026, 8, 31)]} == {("salinity", 0.12), ("water_level", 174)}
    assert [r["recorded_at"] for r in rows[date(2026, 9, 1)]] == ["2026-09-01T00:00:00+07:00"]


def test_one_failing_station_does_not_stop_the_run():
    client = FakeClient({})
    client.daily_max = MagicMock(side_effect=rynan_fetch.RynanApiError("ERR_X"))

    assert rynan_fetch.fetch_days(client, [STATION], [date(2026, 9, 1)]) == {date(2026, 9, 1): []}


def test_written_csv_is_read_back_by_the_rynan_raw_parser(tmp_path):
    client = FakeClient({(2026, 10): {6: {"salinity": 3.2, "water_level": 125}}})
    day = date(2026, 10, 6)

    path = rynan_fetch.write_csv(rynan_fetch.fetch_days(client, [STATION], [day])[day],
                                 tmp_path / "rynan_2026-10-06.csv")

    with open(path, encoding="utf-8") as f:
        assert next(csv.DictReader(f))["recorded_at"] == "2026-10-06T00:00:00+07:00"
    parsed = parse_file(path)
    assert parsed.format == "rynan_raw"
    # Mực nước cm → m
    assert sorted(parsed.measurements["value"]) == [1.25, 3.2]


def test_main_writes_one_file_per_day_and_skips_empty_days(tmp_path, monkeypatch):
    client = FakeClient({(2026, 9): {1: {"salinity": 3.2}}})
    monkeypatch.setattr(rynan_fetch, "RynanClient", lambda *a: client)
    _env(monkeypatch)

    assert rynan_fetch.main(["--from", "2026-08-31", "--to", "2026-09-01", "--out", str(tmp_path)]) == 0
    assert [p.name for p in tmp_path.iterdir()] == ["rynan_2026-09-01.csv"]


def test_main_fails_when_nothing_was_fetched(tmp_path, monkeypatch):
    monkeypatch.setattr(rynan_fetch, "RynanClient", lambda *a: FakeClient({}))
    _env(monkeypatch)

    assert rynan_fetch.main(["--from", "2026-09-01", "--to", "2026-09-01", "--out", str(tmp_path)]) == 1


def test_password_is_encrypted_like_cryptojs():
    # Kiểm chéo bằng: echo <kết quả> | openssl enc -d -aes-256-cbc -md md5 -a -A -k uyt
    assert rynan_fetch.cryptojs_encrypt("mat-khau-thu-123", "uyt", salt=bytes(range(8))) == (
        "U2FsdGVkX18AAQIDBAUGBxMsDaoA4ON1BmcEaT14c8zqGU6LYsmi8pgK0uhSrnEs"
    )


def _response(body, status=200):
    response = MagicMock()
    response.status_code = status
    response.json.return_value = body
    return response


def _client(*responses):
    session = MagicMock()
    session.request.side_effect = list(responses)
    return rynan_fetch.RynanClient("https://api.example", "huy", "secret", session=session, delay=0), session


def test_login_keeps_token_and_customer_code():
    client, session = _client(_response({"success": True, "token": "t0k", "data": {"data": {"CustomerCode": "MK1"}}}))

    client.login()

    assert (client.token, client.customer_code) == ("t0k", "MK1")
    sent = session.request.call_args.kwargs["data"]
    assert sent["Username"] == "huy" and sent["Password"] != "secret" and sent["AppCode"] == "MEKONG"


def test_login_failure_raises_with_the_error_code():
    client, _ = _client(_response({"success": False, "errcode": "ERR_001979"}))

    with pytest.raises(rynan_fetch.RynanApiError, match="ERR_001979"):
        client.login()


def test_stations_and_daily_max_map_the_api_fields():
    client, session = _client(
        _response({"success": True, "data": [
            {"IDAWD": "WLS1", "_idSensorNode": {"SensorNodeCode": "A001", "SNShortName": "Trạm A",
                                                "Latitude": 9.5, "Longitude": 105.2}},
            {"IDAWD": None, "_idSensorNode": None},
        ]}),
        _response({"success": True, "data": [
            {"Time": 1, "MaxSalinity": 0.12}, {"Time": 2, "MaxSalinity": None},
        ]}),
        _response({"success": True, "data": [{"data": [
            {"Time": 1, "MaxWaterLevel": 164}, {"Time": 2, "MaxWaterLevel": 158},
        ]}]}),
    )
    client.token, client.customer_code = "t0k", "MK1"

    stations = client.stations()
    assert stations == [STATION]
    assert client.daily_max(stations[0], 2026, 9) == {1: {"salinity": 0.12, "water_level": 164}, 2: {"water_level": 158}}
    awd_params = session.request.call_args.kwargs["params"]
    assert json.loads(awd_params["ListIDAWD"]) == ["WLS1"] and awd_params["token"] == "t0k"


def test_api_error_code_raises_even_when_success_is_true():
    # Ví dụ tài khoản thường xem biểu đồ theo giờ quá 14 ngày: success true nhưng có errcode
    client, _ = _client(_response({"success": True, "errcode": "ERR_000739", "error": "not allowed"}))

    with pytest.raises(rynan_fetch.RynanApiError, match="ERR_000739"):
        client.api("GetChartAverageOfMonth", SensorNodeCode="A001", Month=9, Year=2026)


def test_upload_overwrites_a_file_with_the_same_name(tmp_path):
    path = tmp_path / "rynan_2026-10-06.csv"
    path.write_text("a,b\n", encoding="utf-8")
    session = MagicMock()
    session.get.return_value = _response({"files": [{"id": "abc"}]})
    session.patch.return_value = _response({"id": "abc"})

    assert rynan_fetch.upload_to_drive(path, "folder", "token", session) == "abc"
    assert session.patch.call_args.args[0].endswith("/files/abc")
    session.post.assert_not_called()


def test_upload_creates_the_file_in_the_folder(tmp_path):
    path = tmp_path / "rynan_2026-10-06.csv"
    path.write_text("a,b\n", encoding="utf-8")
    session = MagicMock()
    session.get.return_value = _response({"files": []})
    session.post.return_value = _response({"id": "new"})

    assert rynan_fetch.upload_to_drive(path, "folder", "token", session) == "new"
    body = session.post.call_args.kwargs["data"]
    assert b'"parents": ["folder"]' in body and b"a,b\n" in body


def test_client_does_not_retry_client_errors():
    session = MagicMock()
    session.request.return_value.status_code = 401
    session.request.return_value.raise_for_status.side_effect = RuntimeError("401")
    client = rynan_fetch.RynanClient("https://api.example", "u", "p", session=session, delay=0)

    with pytest.raises(RuntimeError):
        client.request("POST", "/login")
    assert session.request.call_count == 1
