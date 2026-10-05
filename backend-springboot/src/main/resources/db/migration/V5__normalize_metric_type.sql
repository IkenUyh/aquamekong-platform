-- ============================================================
-- AquaMekong — V5: metric_type luôn là chữ thường
-- Trước đây ingest có thể ghi 'SALINITY' trong khi rule cảnh báo là 'salinity'
-- -> rule không bao giờ khớp. Backend chuẩn hoá ở entity (MetricTypes.normalize),
-- CHECK constraint chặn mọi nguồn ghi khác (vd. ML pipeline).
-- ============================================================

UPDATE measurements SET metric_type = lower(trim(metric_type)) WHERE metric_type <> lower(trim(metric_type));
UPDATE sensors      SET metric_type = lower(trim(metric_type)) WHERE metric_type <> lower(trim(metric_type));
UPDATE alert_rules  SET metric_type = lower(trim(metric_type)) WHERE metric_type <> lower(trim(metric_type));
UPDATE alerts       SET metric_type = lower(trim(metric_type)) WHERE metric_type <> lower(trim(metric_type));

ALTER TABLE measurements ADD CONSTRAINT chk_measurements_metric_type_lower CHECK (metric_type = lower(metric_type));
ALTER TABLE sensors      ADD CONSTRAINT chk_sensors_metric_type_lower      CHECK (metric_type = lower(metric_type));
ALTER TABLE alert_rules  ADD CONSTRAINT chk_alert_rules_metric_type_lower  CHECK (metric_type = lower(metric_type));
ALTER TABLE alerts       ADD CONSTRAINT chk_alerts_metric_type_lower       CHECK (metric_type = lower(metric_type));
