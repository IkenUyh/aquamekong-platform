import os
from unittest.mock import MagicMock

import pandas as pd
import pytest

import app.ingest.inbox as inbox
import app.ingest.loader as loader
from app.ingest.parsers import UnsupportedFormatError, detect_format, parse_file

FEATURES_CSV = """station_id,station_name,date,latitude,longitude,salinity_max,water_level_max_lag_1d,upstream_discharge_lag_1d,rainfall_mm_lag_1d
A001,Trạm A,2026-03-01,9.5,105.2,4.2,,,
A001,Trạm A,2026-03-02,9.5,105.2,,110,8000,2
B002,Trạm B,2026-03-01,9.7,105.4,1.5,-90,7900,0
"""


@pytest.fixture
def features_file(tmp_path):
    path = tmp_path / "AquaMekong_CLEAN_FEATURES_FINAL.csv"
    path.write_text(FEATURES_CSV, encoding="utf-8")
    return path


def _values(measurements):
    return {
        (r.station_code, r.metric_type, r.recorded_at.strftime("%Y-%m-%d %H:%M%z"), r.value)
        for r in measurements.itertuples()
    }


def test_features_lag_columns_are_recorded_on_the_previous_day(features_file):
    parsed = parse_file(features_file)

    assert parsed.format == "features"
    # Ô trống bị bỏ; *_lag_1d ghi vào ngày hôm trước; giờ Việt Nam; mực nước cm → m
    assert _values(parsed.measurements) == {
        ("A001", "salinity", "2026-03-01 00:00+0700", 4.2),
        ("A001", "water_level", "2026-03-01 00:00+0700", 1.1),
        ("A001", "flow_rate", "2026-03-01 00:00+0700", 8000.0),
        ("B002", "salinity", "2026-03-01 00:00+0700", 1.5),
        ("B002", "water_level", "2026-02-28 00:00+0700", -0.9),
        ("B002", "flow_rate", "2026-02-28 00:00+0700", 7900.0),
    }
    stations = parsed.stations.set_index("station_code")
    assert stations.loc["B002", "station_name"] == "Trạm B"
    assert stations.loc["A001", "latitude"] == 9.5


RYNAN_RAW_CSV = """station_code,station_name,latitude,longitude,recorded_at,metric,value
A001,Trạm A,9.5,105.2,2026-10-06T07:00:00+07:00,salinity,3.2
A001,Trạm A,9.5,105.2,2026-10-06T07:00:00+07:00,water_level,125
A001,Trạm A,9.5,105.2,2026-10-06T07:00:00+07:00,ph,7.6
A001,Trạm A,9.5,105.2,2026-10-06T08:00:00+07:00,salinity,
B002,Trạm B,9.7,105.4,2026-10-06T08:00:00,salinity,0.4
"""


def test_rynan_raw_keeps_hourly_readings_and_converts_water_level(tmp_path):
    path = tmp_path / "rynan_2026-10-06.csv"
    path.write_text(RYNAN_RAW_CSV, encoding="utf-8")

    parsed = parse_file(path)

    assert parsed.format == "rynan_raw"
    # Giữ giờ đo; giờ không có múi giờ hiểu là giờ Việt Nam; mực nước cm → m; pH và ô trống bị bỏ
    assert _values(parsed.measurements) == {
        ("A001", "salinity", "2026-10-06 07:00+0700", 3.2),
        ("A001", "water_level", "2026-10-06 07:00+0700", 1.25),
        ("B002", "salinity", "2026-10-06 08:00+0700", 0.4),
    }
    assert sorted(parsed.stations["station_code"]) == ["A001", "B002"]
    # Thiếu mưa, lưu lượng thượng nguồn... nên không gộp vào kho feature ST-GNN
    assert parsed.features is None


def test_unknown_header_is_rejected_with_the_columns_found():
    with pytest.raises(UnsupportedFormatError, match="Thời gian"):
        detect_format(["Thời gian", "Mã trạm", "Độ mặn"])


def test_loader_inserts_matched_rows_and_reports_unmatched(features_file, monkeypatch):
    sensors = pd.DataFrame([
        {"station_code": "A001", "station_id": 10, "metric_type": m, "sensor_id": i, "unit": u}
        for i, (m, u) in enumerate([("salinity", "‰"), ("water_level", "m"), ("flow_rate", "m³/s")], start=1)
    ])
    monkeypatch.setattr(loader, "upsert_stations", lambda conn, stations: len(stations))
    monkeypatch.setattr(loader, "get_crawler_sensor_mapping", lambda conn: sensors)

    conn = MagicMock()
    conn.execute.return_value.rowcount = 2
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = conn

    report = loader.import_file(features_file, engine=engine)

    params = conn.execute.call_args.args[1]
    assert sorted(params["sensor_id"]) == [1, 2, 3]
    assert set(params["station_id"]) == {10}
    assert "ON CONFLICT (sensor_id, recorded_at) DO NOTHING" in str(conn.execute.call_args.args[0])
    assert (report.stations, report.parsed, report.inserted, report.unmatched, report.duplicates) == (2, 6, 2, 3, 1)
    conn.begin.return_value.commit.assert_called_once()


def test_dry_run_rolls_back(features_file, monkeypatch):
    monkeypatch.setattr(loader, "upsert_stations", lambda conn, stations: 0)
    monkeypatch.setattr(loader, "get_crawler_sensor_mapping",
                        lambda conn: pd.DataFrame(columns=["station_code", "station_id", "metric_type", "sensor_id", "unit"]))
    conn = MagicMock()
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = conn

    loader.import_file(features_file, dry_run=True, engine=engine)

    conn.begin.return_value.rollback.assert_called_once()
    conn.begin.return_value.commit.assert_not_called()


def test_inbox_moves_files_to_processed_or_failed(tmp_path, monkeypatch):
    (tmp_path / "ok.csv").write_text("x", encoding="utf-8")
    (tmp_path / "bad.csv").write_text("x", encoding="utf-8")
    (tmp_path / "ghi-chu.txt").write_text("x", encoding="utf-8")

    def fake_import(path):
        if path.name == "bad.csv":
            raise UnsupportedFormatError("Không nhận diện được định dạng file")
        return "ok"

    monkeypatch.setattr(inbox, "import_file", fake_import)

    assert inbox.process_inbox(tmp_path, min_age_seconds=0) == ["ok"]

    assert [p.name.split("_", 1)[1] for p in (tmp_path / "processed").iterdir()] == ["ok.csv"]
    failed = sorted(p.name.split("_", 1)[1] for p in (tmp_path / "failed").iterdir())
    assert failed == ["bad.csv", "bad.csv.error.txt"]
    assert (tmp_path / "ghi-chu.txt").exists()


def test_inbox_waits_for_files_still_being_copied(tmp_path, monkeypatch):
    (tmp_path / "dang-chep.csv").write_text("x", encoding="utf-8")
    monkeypatch.setattr(inbox, "import_file", lambda path: pytest.fail("không được nạp file vừa ghi"))

    assert inbox.process_inbox(tmp_path) == []
    assert (tmp_path / "dang-chep.csv").exists()


def test_upsert_adds_default_rule_only_for_new_stations_and_removes_demo():
    from app.ingest.stations import upsert_stations

    conn = MagicMock()
    conn.execute.return_value.scalar_one.return_value = 1           # river id
    conn.execute.return_value.scalars.return_value = ["A001"]       # A001 đã có trong DB
    stations = pd.DataFrame([
        {"station_code": "A001", "station_name": "Trạm A", "latitude": 9.5, "longitude": 105.2},
        {"station_code": "B002", "station_name": "Trạm B", "latitude": 9.7, "longitude": 105.4},
    ])

    assert upsert_stations(conn, stations) == 2

    calls = [(str(c.args[0]), c.args[1] if len(c.args) > 1 else None) for c in conn.execute.call_args_list]
    rule_params = [p for sql, p in calls if "INSERT INTO alert_rules" in sql]
    assert rule_params == [{"codes": ["B002"], "threshold": 4.0}]
    assert any("DELETE FROM stations" in sql and "CT-001" in p["codes"] for sql, p in calls)
