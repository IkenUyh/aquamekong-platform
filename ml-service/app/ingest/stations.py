"""
Tạo/cập nhật trạm từ file dữ liệu, kèm device CRAWLER và 3 sensor như Flyway V3,
để số đo nạp vào gắn được với sensor (measurements.sensor_id là NOT NULL).
"""

import pandas as pd
from sqlalchemy import text

DEFAULT_RIVER = "Chưa phân loại"

# Trạm demo seed ở Flyway V2 (số đo giả), bị xoá khi nạp dữ liệu trạm thật
DEMO_STATION_CODES = ("CT-001", "MT-001", "BT-001", "TV-001", "ST-001", "CM-001")

_UPSERT_STATION = text("""
    INSERT INTO stations (code, name, location, river_id, status)
    VALUES (:code, :name, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :river_id, 'ACTIVE')
    ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, location = EXCLUDED.location, updated_at = NOW()
""")

# Giống V3__crawler_sensors.sql: idempotent nhờ ON CONFLICT
_CRAWLER_DEVICES = text("""
    INSERT INTO devices (station_id, device_code, name, device_type, manufacturer, status, installed_at)
    SELECT s.id, 'CRAWLER-' || s.code, 'Data Crawler ' || s.name, 'CRAWLER', 'AquaMekong', 'ONLINE', NOW()
    FROM stations s
    ON CONFLICT (device_code) DO NOTHING
""")

_CRAWLER_SENSORS = text("""
    INSERT INTO sensors (device_id, sensor_code, name, metric_type, unit, status)
    SELECT d.id, 'CRW-' || s.code || '-' || m.suffix, m.label || ' (crawler) ' || s.code, m.metric_type, m.unit, 'ACTIVE'
    FROM devices d
    JOIN stations s ON s.id = d.station_id
    CROSS JOIN (VALUES
        ('salinity',    'SAL', 'Độ mặn',   '‰'),
        ('water_level', 'WL',  'Mực nước', 'm'),
        ('flow_rate',   'FR',  'Lưu lượng', 'm³/s')
    ) AS m(metric_type, suffix, label, unit)
    WHERE d.device_type = 'CRAWLER'
    ON CONFLICT (sensor_code) DO NOTHING
""")


# Như Flyway V11: tỉnh chứa trạm, hoặc tỉnh gần nhất trong ~5 km (trạm ven biển, cửa sông).
# Chỉ trạm chưa có tỉnh, để không ghi đè tỉnh admin đã sửa.
_ASSIGN_PROVINCES = text("""
    UPDATE stations s
    SET province = (
        SELECT p.name FROM provinces p
        WHERE ST_DWithin(p.geom, s.location, 0.05)
        ORDER BY ST_Distance(p.geom, s.location)
        LIMIT 1
    )
    WHERE s.code = ANY(:codes) AND s.province IS NULL
""")


# Cùng ngưỡng với backend classifySalinity và frontend utils/salinity.ts
SALINITY_THRESHOLD = 4.0

_DEFAULT_ALERT_RULES = text("""
    INSERT INTO alert_rules (station_id, metric_type, operator, threshold, severity)
    SELECT s.id, 'salinity', '>', :threshold, 'HIGH'
    FROM stations s
    WHERE s.code = ANY(:codes)
      AND NOT EXISTS (SELECT 1 FROM alert_rules r WHERE r.station_id = s.id AND r.metric_type = 'salinity')
""")


def _river_id(conn) -> int:
    conn.execute(
        text("INSERT INTO rivers (name, description) VALUES (:name, :desc) ON CONFLICT (name) DO NOTHING"),
        {"name": DEFAULT_RIVER, "desc": "Trạm nạp từ dữ liệu RYNAN, chưa gán sông"},
    )
    return conn.execute(text("SELECT id FROM rivers WHERE name = :name"), {"name": DEFAULT_RIVER}).scalar_one()


def upsert_stations(conn, stations: pd.DataFrame, create: bool = True) -> int:
    """
    Trả về số trạm được tạo/cập nhật. Trạm thiếu toạ độ chỉ dùng được nếu đã có trong DB.
    create=False: chỉ cập nhật trạm đã có, bỏ qua trạm mới.
    """
    located = stations.dropna(subset=["latitude", "longitude"])
    if located.empty:
        return 0

    codes = located["station_code"].tolist()
    existing = set(conn.execute(text("SELECT code FROM stations WHERE code = ANY(:codes)"), {"codes": codes}).scalars())
    if not create:
        located = located[located["station_code"].isin(existing)]
        if located.empty:
            return 0
        codes = located["station_code"].tolist()

    river_id = _river_id(conn)
    conn.execute(_UPSERT_STATION, [
        {
            "code": row.station_code,
            "name": row.station_name if isinstance(row.station_name, str) and row.station_name else row.station_code,
            "lat": float(row.latitude),
            "lon": float(row.longitude),
            "river_id": river_id,
        }
        for row in located.itertuples(index=False)
    ])
    conn.execute(_CRAWLER_DEVICES)
    conn.execute(_CRAWLER_SENSORS)
    # Bảng provinces do Flyway V11 tạo; backend cũ chưa có thì bỏ qua, trạm để trống tỉnh như trước
    if conn.execute(text("SELECT to_regclass('provinces') IS NOT NULL")).scalar():
        conn.execute(_ASSIGN_PROVINCES, {"codes": codes})
    # Rule mặc định chỉ cho trạm mới tạo, để không tạo lại rule admin đã xoá
    new_codes = [c for c in codes if c not in existing]
    if new_codes:
        conn.execute(_DEFAULT_ALERT_RULES, {"codes": new_codes, "threshold": SALINITY_THRESHOLD})
    # Trạm demo chỉ có số đo giả: xoá hẳn (CASCADE số đo, rule, cảnh báo, dự báo) để không lẫn vào thống kê
    conn.execute(text("DELETE FROM stations WHERE code = ANY(:codes)"), {"codes": list(DEMO_STATION_CODES)})
    return len(located)
