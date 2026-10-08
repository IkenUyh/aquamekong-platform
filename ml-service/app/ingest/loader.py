"""
Nạp một file dữ liệu vào DB: parse → tạo/cập nhật trạm → gắn sensor → insert measurements.
Chạy lại cùng file không tạo bản ghi trùng (unique (sensor_id, recorded_at), Flyway V6).
"""

import logging
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import text

from app.db import get_engine
from app.ingest.features_store import append_features
from app.ingest.parsers import parse_file
from app.ingest.stations import upsert_stations
from app.pipeline.sensors import get_crawler_sensor_mapping

logger = logging.getLogger(__name__)

CHUNK_SIZE = 5000

# Một câu lệnh cho cả lô (unnest mảng), nên rowcount là số dòng thực sự được thêm
_INSERT_CHUNK = text("""
    INSERT INTO measurements (sensor_id, station_id, metric_type, value, unit, recorded_at)
    SELECT * FROM unnest(
        CAST(:sensor_id AS bigint[]), CAST(:station_id AS bigint[]), CAST(:metric_type AS varchar[]),
        CAST(:value AS double precision[]), CAST(:unit AS varchar[]), CAST(:recorded_at AS timestamptz[])
    )
    ON CONFLICT (sensor_id, recorded_at) DO NOTHING
""")


@dataclass
class ImportReport:
    file: str
    format: str
    stations: int
    parsed: int
    inserted: int
    unmatched: int
    dry_run: bool

    @property
    def duplicates(self) -> int:
        return self.parsed - self.unmatched - self.inserted

    def __str__(self) -> str:
        mode = " (chạy thử, đã rollback)" if self.dry_run else ""
        return (
            f"{self.file} [{self.format}]{mode}: {self.stations} trạm, {self.parsed} số đo đọc được, "
            f"{self.inserted} thêm mới, {self.duplicates} đã có, {self.unmatched} không khớp trạm/sensor"
        )


def import_file(path, dry_run: bool = False, engine=None) -> ImportReport:
    path = Path(path)
    parsed = parse_file(path)
    engine = engine or get_engine()

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            stations = upsert_stations(conn, parsed.stations)
            sensors = get_crawler_sensor_mapping(conn)
            rows = parsed.measurements.merge(sensors, on=["station_code", "metric_type"], how="inner")
            unmatched = len(parsed.measurements) - len(rows)
            if unmatched:
                missing = sorted(set(parsed.measurements["station_code"]) - set(sensors["station_code"]))
                logger.warning(f"{unmatched} số đo không có sensor CRAWLER (trạm chưa có trong DB: {missing[:10]})")

            inserted = 0
            for start in range(0, len(rows), CHUNK_SIZE):
                chunk = rows.iloc[start:start + CHUNK_SIZE]
                result = conn.execute(_INSERT_CHUNK, {
                    "sensor_id": chunk["sensor_id"].astype(int).tolist(),
                    "station_id": chunk["station_id"].astype(int).tolist(),
                    "metric_type": chunk["metric_type"].tolist(),
                    "value": chunk["value"].astype(float).tolist(),
                    "unit": chunk["unit"].tolist(),
                    "recorded_at": chunk["recorded_at"].dt.to_pydatetime().tolist(),
                })
                inserted += result.rowcount

            if dry_run:
                trans.rollback()
            else:
                trans.commit()
                if parsed.features is not None:
                    rows = append_features(parsed.features)
                    logger.info(f"Kho feature ST-GNN: {rows} dòng")
        except Exception:
            trans.rollback()
            raise

    report = ImportReport(path.name, parsed.format, stations, len(parsed.measurements), inserted, unmatched, dry_run)
    logger.info(str(report))
    return report
