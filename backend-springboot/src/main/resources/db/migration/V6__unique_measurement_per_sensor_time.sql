-- ============================================================
-- AquaMekong — V6: mỗi cảm biến chỉ có 1 số đo tại 1 thời điểm
-- Trước đây pipeline chỉ chống trùng bằng Redis -> mất key Redis là ghi trùng,
-- làm sai trung bình báo cáo và biểu đồ.
-- ============================================================

-- Giữ bản ghi đầu tiên (id nhỏ nhất) của mỗi (sensor_id, recorded_at)
DELETE FROM measurements m
USING measurements d
WHERE m.sensor_id = d.sensor_id
  AND m.recorded_at = d.recorded_at
  AND m.id > d.id;

ALTER TABLE measurements
    ADD CONSTRAINT uq_measurements_sensor_time UNIQUE (sensor_id, recorded_at);

-- Unique index (sensor_id, recorded_at DESC) đã phủ idx_measurements_sensor_time
DROP INDEX IF EXISTS idx_measurements_sensor_time;
