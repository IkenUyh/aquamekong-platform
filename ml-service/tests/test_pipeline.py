from unittest.mock import MagicMock

import pandas as pd

import app.pipeline.scheduler as scheduler

RAW = [{"station_code": "CT-001", "recorded_at": "2026-10-01T03:00:00+00:00",
        "salinity": 1.5, "water_level": 1.1, "flow_rate": 3000}]

SENSORS = pd.DataFrame([
    {"station_code": "CT-001", "station_id": 1, "metric_type": m, "sensor_id": i, "unit": u}
    for i, (m, u) in enumerate([("salinity", "‰"), ("water_level", "m"), ("flow_rate", "m³/s")], start=1)
])


def _setup(monkeypatch, fail_insert=False):
    crawler = MagicMock()
    crawler.fetch_data.return_value = RAW
    monkeypatch.setattr(scheduler, "Crawler", lambda: crawler)

    conn = MagicMock()
    if fail_insert:
        conn.execute.side_effect = RuntimeError("db down")
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(scheduler, "get_engine", lambda: engine)
    monkeypatch.setattr(scheduler, "get_crawler_sensor_mapping", lambda e: SENSORS)
    return crawler, conn


def test_pipeline_writes_one_row_per_metric_in_real_units(monkeypatch):
    crawler, conn = _setup(monkeypatch)

    scheduler.run_pipeline()

    rows = conn.execute.call_args.args[1]
    assert {(r["metric_type"], r["value"], r["sensor_id"]) for r in rows} == {
        ("salinity", 1.5, 1), ("water_level", 1.1, 2), ("flow_rate", 3000.0, 3),
    }
    crawler.mark_processed.assert_called_once_with(RAW)


def test_failed_insert_does_not_mark_data_as_processed(monkeypatch):
    crawler, _ = _setup(monkeypatch, fail_insert=True)

    scheduler.run_pipeline()

    crawler.mark_processed.assert_not_called()
