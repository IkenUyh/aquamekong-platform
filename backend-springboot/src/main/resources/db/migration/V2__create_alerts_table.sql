CREATE TABLE alerts (
    id              BIGSERIAL PRIMARY KEY,
    station_id      BIGINT NOT NULL REFERENCES stations(id),
    alert_type      VARCHAR(50) NOT NULL,      -- 'SALINITY_THRESHOLD', 'WATER_LEVEL', 'FLOW_RATE'
    severity        VARCHAR(20) NOT NULL,       -- 'WARNING', 'CRITICAL', 'INFO'
    message         TEXT NOT NULL,
    threshold_value DOUBLE PRECISION,
    actual_value    DOUBLE PRECISION,
    is_resolved     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_alerts_station_id ON alerts(station_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity);
