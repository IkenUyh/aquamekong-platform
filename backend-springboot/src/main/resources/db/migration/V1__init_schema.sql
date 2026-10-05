-- ============================================================
-- AquaMekong — V1: Initial Schema
-- PostgreSQL 16 + PostGIS
-- ============================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. STATIONS — Trạm quan trắc thủy văn
-- ============================================================
CREATE TABLE stations (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    location    geometry(Point, 4326) NOT NULL,
    river_name  VARCHAR(255),
    province    VARCHAR(100),
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Spatial index for geo-queries
CREATE INDEX idx_stations_location ON stations USING GIST (location);
CREATE INDEX idx_stations_code     ON stations (code);
CREATE INDEX idx_stations_status   ON stations (status);

-- ============================================================
-- 2. WATER_METRICS — Chỉ số thủy văn theo thời gian
-- ============================================================
CREATE TABLE water_metrics (
    id          BIGSERIAL PRIMARY KEY,
    station_id  BIGINT       NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    salinity    DOUBLE PRECISION,          -- Độ mặn (‰ - phần nghìn)
    water_level DOUBLE PRECISION,          -- Mực nước (m)
    flow_rate   DOUBLE PRECISION,          -- Lưu lượng (m³/s)
    recorded_at TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Composite index for time-series queries
CREATE INDEX idx_water_metrics_station_time
    ON water_metrics (station_id, recorded_at DESC);

CREATE INDEX idx_water_metrics_recorded_at
    ON water_metrics (recorded_at DESC);

-- ============================================================
-- 3. SALINITY_FORECASTS — Kết quả dự báo xâm nhập mặn
-- ============================================================
CREATE TABLE salinity_forecasts (
    id                  BIGSERIAL PRIMARY KEY,
    station_id          BIGINT          NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    forecast_date       DATE            NOT NULL,
    predicted_salinity  DOUBLE PRECISION NOT NULL,  -- Độ mặn dự báo (‰)
    confidence_level    DOUBLE PRECISION,           -- Mức tin cậy (0-1)
    lower_bound         DOUBLE PRECISION,           -- Cận dưới khoảng tin cậy
    upper_bound         DOUBLE PRECISION,           -- Cận trên khoảng tin cậy
    model_version       VARCHAR(50),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forecasts_station_date
    ON salinity_forecasts (station_id, forecast_date DESC);

-- ============================================================
-- 4. SEED DATA — 6 trạm đo thực tế vùng ĐBSCL
-- ============================================================
INSERT INTO stations (code, name, location, river_name, province, status) VALUES
    ('CT-001', 'Trạm Cần Thơ',    ST_SetSRID(ST_MakePoint(105.7469, 10.0452), 4326), 'Sông Hậu',         'Cần Thơ',   'ACTIVE'),
    ('MT-001', 'Trạm Mỹ Tho',     ST_SetSRID(ST_MakePoint(106.3590, 10.3600), 4326), 'Sông Tiền',        'Tiền Giang', 'ACTIVE'),
    ('BT-001', 'Trạm Bến Tre',    ST_SetSRID(ST_MakePoint(106.3756, 10.2415), 4326), 'Sông Hàm Luông',   'Bến Tre',    'ACTIVE'),
    ('TV-001', 'Trạm Trà Vinh',   ST_SetSRID(ST_MakePoint(106.3420, 9.9347),  4326), 'Sông Cổ Chiên',    'Trà Vinh',   'ACTIVE'),
    ('ST-001', 'Trạm Sóc Trăng',  ST_SetSRID(ST_MakePoint(105.9800, 9.6039),  4326), 'Sông Hậu',         'Sóc Trăng',  'ACTIVE'),
    ('CM-001', 'Trạm Cà Mau',     ST_SetSRID(ST_MakePoint(105.1500, 9.1769),  4326), 'Sông Gành Hào',    'Cà Mau',     'ACTIVE');

-- Seed water metrics (dữ liệu mẫu các chỉ số gần đây)
INSERT INTO water_metrics (station_id, salinity, water_level, flow_rate, recorded_at) VALUES
    -- Cần Thơ — Nước ngọt, mặn thấp
    (1, 0.3,  1.52, 8500.0,  NOW() - INTERVAL '2 hours'),
    (1, 0.4,  1.48, 8200.0,  NOW() - INTERVAL '1 hour'),
    (1, 0.35, 1.50, 8350.0,  NOW()),
    -- Mỹ Tho — Mặn trung bình
    (2, 2.1,  1.20, 4200.0,  NOW() - INTERVAL '2 hours'),
    (2, 2.5,  1.15, 4000.0,  NOW() - INTERVAL '1 hour'),
    (2, 2.8,  1.10, 3800.0,  NOW()),
    -- Bến Tre — Mặn cao (vùng cửa sông)
    (3, 5.2,  0.95, 2100.0,  NOW() - INTERVAL '2 hours'),
    (3, 5.8,  0.90, 1900.0,  NOW() - INTERVAL '1 hour'),
    (3, 6.1,  0.85, 1750.0,  NOW()),
    -- Trà Vinh — Mặn trung bình-cao
    (4, 3.5,  1.05, 3100.0,  NOW() - INTERVAL '2 hours'),
    (4, 3.8,  1.00, 2900.0,  NOW() - INTERVAL '1 hour'),
    (4, 4.2,  0.95, 2700.0,  NOW()),
    -- Sóc Trăng — Mặn cao
    (5, 4.8,  0.80, 2500.0,  NOW() - INTERVAL '2 hours'),
    (5, 5.1,  0.75, 2300.0,  NOW() - INTERVAL '1 hour'),
    (5, 5.5,  0.70, 2100.0,  NOW()),
    -- Cà Mau — Mặn rất cao (ven biển)
    (6, 8.5,  0.60, 1200.0,  NOW() - INTERVAL '2 hours'),
    (6, 9.0,  0.55, 1100.0,  NOW() - INTERVAL '1 hour'),
    (6, 9.3,  0.50, 1000.0,  NOW());

-- Sample salinity forecasts
INSERT INTO salinity_forecasts (station_id, forecast_date, predicted_salinity, confidence_level, lower_bound, upper_bound, model_version) VALUES
    (3, CURRENT_DATE + 1, 6.5,  0.85, 5.8, 7.2, 'prophet-v1.0'),
    (3, CURRENT_DATE + 2, 7.0,  0.80, 6.0, 8.0, 'prophet-v1.0'),
    (3, CURRENT_DATE + 3, 6.8,  0.75, 5.5, 8.1, 'prophet-v1.0'),
    (5, CURRENT_DATE + 1, 5.8,  0.85, 5.0, 6.6, 'prophet-v1.0'),
    (5, CURRENT_DATE + 2, 6.2,  0.80, 5.2, 7.2, 'prophet-v1.0'),
    (6, CURRENT_DATE + 1, 9.8,  0.90, 9.0, 10.6, 'prophet-v1.0'),
    (6, CURRENT_DATE + 2, 10.2, 0.85, 9.2, 11.2, 'prophet-v1.0');
