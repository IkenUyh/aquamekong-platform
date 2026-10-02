-- ============================================================
-- AquaMekong — V4: Index theo đúng các truy vấn đang dùng
-- ============================================================

-- measurements: "giá trị mới nhất của 1 chỉ số tại 1 trạm"
-- (findLatestByStationIdAndMetricType, đánh giá cảnh báo, ML data_loader)
CREATE INDEX IF NOT EXISTS idx_measurements_station_metric_time
    ON measurements (station_id, metric_type, recorded_at DESC);

-- Index không có truy vấn nào dùng, chỉ làm chậm INSERT trên bảng ghi nhiều nhất
DROP INDEX IF EXISTS idx_measurements_recorded_at;
DROP INDEX IF EXISTS idx_measurements_quality;

-- alerts: danh sách cảnh báo theo trạm, mới nhất trước
CREATE INDEX IF NOT EXISTS idx_alerts_station_time
    ON alerts (station_id, triggered_at DESC);
DROP INDEX IF EXISTS idx_alerts_station;

-- salinity_forecasts: tìm lượt chạy mới nhất của 1 trạm (findLatestRunByStationId)
CREATE INDEX IF NOT EXISTS idx_forecasts_station_run
    ON salinity_forecasts (station_id, run_id DESC);

-- users.email đã UNIQUE (có sẵn unique index) → index thường bị trùng
DROP INDEX IF EXISTS idx_users_email;
