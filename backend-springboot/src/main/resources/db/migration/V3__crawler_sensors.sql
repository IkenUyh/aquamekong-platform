-- ============================================================
-- AquaMekong — V3: Thiết bị & cảm biến ảo cho Data Pipeline
-- measurements.sensor_id là NOT NULL, nên dữ liệu do ML service
-- crawl về cần gắn vào một sensor. Mỗi trạm có 1 device CRAWLER
-- với 3 sensor: salinity, water_level, flow_rate.
-- ============================================================

INSERT INTO devices (station_id, device_code, name, device_type, manufacturer, status, installed_at)
SELECT s.id, 'CRAWLER-' || s.code, 'Data Crawler ' || s.name, 'CRAWLER', 'AquaMekong', 'ONLINE', NOW()
FROM stations s
ON CONFLICT (device_code) DO NOTHING;

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
ON CONFLICT (sensor_code) DO NOTHING;
