-- ============================================================
-- AquaMekong — V2: Production ERD Schema
-- PostgreSQL 16 + PostGIS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'station_status') THEN
        CREATE TYPE station_status AS ENUM ('ACTIVE', 'INACTIVE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status') THEN
        CREATE TYPE device_status AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'INACTIVE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sensor_status') THEN
        CREATE TYPE sensor_status AS ENUM ('ACTIVE', 'INACTIVE', 'CALIBRATION', 'ERROR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_status') THEN
        CREATE TYPE quality_status AS ENUM ('VALID', 'INVALID', 'SUSPECT', 'MISSING', 'CALIBRATION');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'forecast_run_status') THEN
        CREATE TYPE forecast_run_status AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
        CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
        CREATE TYPE alert_status AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;
END $$;

-- Drop legacy V1 basic tables to replace with complete ERD schema
DROP TABLE IF EXISTS salinity_forecasts CASCADE;
DROP TABLE IF EXISTS water_metrics CASCADE;
DROP TABLE IF EXISTS stations CASCADE;

-- ------------------------------------------------------------
-- 2. RIVERS
-- ------------------------------------------------------------
CREATE TABLE rivers (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rivers_name ON rivers (name);

-- ------------------------------------------------------------
-- 3. STATIONS
-- ------------------------------------------------------------
CREATE TABLE stations (
    id          BIGSERIAL PRIMARY KEY,
    river_id    BIGINT        NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
    code        VARCHAR(50)   NOT NULL UNIQUE,
    name        VARCHAR(255)  NOT NULL,
    location    geometry(Point, 4326) NOT NULL,
    province    VARCHAR(100),
    status      station_status NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stations_river_id ON stations (river_id);
CREATE INDEX idx_stations_province ON stations (province);
CREATE INDEX idx_stations_status   ON stations (status);
CREATE INDEX idx_stations_location ON stations USING GIST (location);

-- ------------------------------------------------------------
-- 4. DEVICES
-- ------------------------------------------------------------
CREATE TABLE devices (
    id            BIGSERIAL PRIMARY KEY,
    station_id    BIGINT        NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    device_code   VARCHAR(50)   NOT NULL UNIQUE,
    name          VARCHAR(255),
    device_type   VARCHAR(50)   NOT NULL,
    manufacturer  VARCHAR(100),
    model         VARCHAR(100),
    serial_number VARCHAR(100),
    status        device_status NOT NULL DEFAULT 'ONLINE',
    installed_at  TIMESTAMPTZ,
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_station_id ON devices (station_id);
CREATE INDEX idx_devices_status     ON devices (status);
CREATE INDEX idx_devices_last_seen  ON devices (last_seen_at);

-- ------------------------------------------------------------
-- 5. SENSORS
-- ------------------------------------------------------------
CREATE TABLE sensors (
    id               BIGSERIAL PRIMARY KEY,
    device_id        BIGINT        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sensor_code      VARCHAR(50)   NOT NULL UNIQUE,
    name             VARCHAR(255),
    metric_type      VARCHAR(50)   NOT NULL,
    unit             VARCHAR(20)   NOT NULL,
    calibration_date TIMESTAMPTZ,
    status           sensor_status NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sensors_device_id   ON sensors (device_id);
CREATE INDEX idx_sensors_metric_type ON sensors (metric_type);
CREATE INDEX idx_sensors_status      ON sensors (status);

-- ------------------------------------------------------------
-- 6. MEASUREMENTS
-- ------------------------------------------------------------
CREATE TABLE measurements (
    id             BIGSERIAL PRIMARY KEY,
    sensor_id      BIGINT         NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    station_id     BIGINT         NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    metric_type    VARCHAR(50)    NOT NULL,
    value          DOUBLE PRECISION NOT NULL,
    unit           VARCHAR(20)    NOT NULL,
    recorded_at    TIMESTAMPTZ    NOT NULL,
    quality_status quality_status NOT NULL DEFAULT 'VALID',
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_measurements_station_time ON measurements (station_id, recorded_at DESC);
CREATE INDEX idx_measurements_sensor_time  ON measurements (sensor_id, recorded_at DESC);
CREATE INDEX idx_measurements_metric_time  ON measurements (metric_type, recorded_at DESC);
CREATE INDEX idx_measurements_recorded_at  ON measurements (recorded_at DESC);
CREATE INDEX idx_measurements_quality      ON measurements (quality_status);

-- ------------------------------------------------------------
-- 7. FORECAST RUNS
-- ------------------------------------------------------------
CREATE TABLE forecast_runs (
    id            BIGSERIAL PRIMARY KEY,
    model_version VARCHAR(50)          NOT NULL,
    run_at        TIMESTAMPTZ          NOT NULL,
    input_from    TIMESTAMPTZ,
    input_to      TIMESTAMPTZ,
    status        forecast_run_status  NOT NULL DEFAULT 'RUNNING',
    created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forecast_runs_model  ON forecast_runs (model_version);
CREATE INDEX idx_forecast_runs_run_at ON forecast_runs (run_at DESC);
CREATE INDEX idx_forecast_runs_status ON forecast_runs (status);

-- ------------------------------------------------------------
-- 8. SALINITY FORECASTS
-- ------------------------------------------------------------
CREATE TABLE salinity_forecasts (
    id                 BIGSERIAL PRIMARY KEY,
    run_id             BIGINT           NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
    station_id         BIGINT           NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    forecast_date      DATE             NOT NULL,
    predicted_salinity DOUBLE PRECISION NOT NULL,
    lower_bound        DOUBLE PRECISION,
    upper_bound        DOUBLE PRECISION,
    confidence_level   DOUBLE PRECISION,
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_forecast_run_station_date UNIQUE (run_id, station_id, forecast_date)
);

CREATE INDEX idx_forecasts_station_date ON salinity_forecasts (station_id, forecast_date DESC);

-- ------------------------------------------------------------
-- 9. ALERT RULES
-- ------------------------------------------------------------
CREATE TABLE alert_rules (
    id          BIGSERIAL PRIMARY KEY,
    station_id  BIGINT         NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    metric_type VARCHAR(50)    NOT NULL,
    operator    VARCHAR(10)    NOT NULL,
    threshold   DOUBLE PRECISION NOT NULL,
    severity    alert_severity NOT NULL DEFAULT 'MEDIUM',
    is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_station ON alert_rules (station_id);
CREATE INDEX idx_alert_rules_metric  ON alert_rules (metric_type);
CREATE INDEX idx_alert_rules_active  ON alert_rules (is_active);

-- ------------------------------------------------------------
-- 10. ALERTS
-- ------------------------------------------------------------
CREATE TABLE alerts (
    id           BIGSERIAL PRIMARY KEY,
    station_id   BIGINT         NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    rule_id      BIGINT         NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    metric_type  VARCHAR(50)    NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    threshold    DOUBLE PRECISION NOT NULL,
    severity     alert_severity NOT NULL,
    status       alert_status   NOT NULL DEFAULT 'ACTIVE',
    triggered_at TIMESTAMPTZ    NOT NULL,
    resolved_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_station      ON alerts (station_id);
CREATE INDEX idx_alerts_status       ON alerts (status);
CREATE INDEX idx_alerts_severity     ON alerts (severity);
CREATE INDEX idx_alerts_triggered_at ON alerts (triggered_at DESC);

-- ------------------------------------------------------------
-- 11. USERS
-- ------------------------------------------------------------
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255),
    status        user_status  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_status ON users (status);

-- ------------------------------------------------------------
-- 12. ROLES
-- ------------------------------------------------------------
CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 13. USER ↔ ROLE (Many-to-Many)
-- ------------------------------------------------------------
CREATE TABLE user_roles (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id    BIGINT      NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles (user_id);
CREATE INDEX idx_user_roles_role ON user_roles (role_id);

-- ------------------------------------------------------------
-- 14. SEED DATA — Initial Sông & Trạm & Thiết bị & Cảm biến mẫu
-- ------------------------------------------------------------
INSERT INTO rivers (name, description) VALUES
    ('Sông Hậu', 'Nhánh sông Mekong chảy qua Cần Thơ, Sóc Trăng'),
    ('Sông Tiền', 'Nhánh sông Mekong chảy qua Tiền Giang'),
    ('Sông Hàm Luông', 'Nhánh sông tại Bến Tre'),
    ('Sông Cổ Chiên', 'Nhánh sông tại Trà Vinh'),
    ('Sông Gành Hào', 'Nhánh sông tại Cà Mau');

INSERT INTO stations (code, name, location, river_id, province, status) VALUES
    ('CT-001', 'Trạm Cần Thơ',   ST_SetSRID(ST_MakePoint(105.7469, 10.0452), 4326), 1, 'Cần Thơ',   'ACTIVE'),
    ('MT-001', 'Trạm Mỹ Tho',    ST_SetSRID(ST_MakePoint(106.3590, 10.3600), 4326), 2, 'Tiền Giang', 'ACTIVE'),
    ('BT-001', 'Trạm Bến Tre',   ST_SetSRID(ST_MakePoint(106.3756, 10.2415), 4326), 3, 'Bến Tre',    'ACTIVE'),
    ('TV-001', 'Trạm Trà Vinh',  ST_SetSRID(ST_MakePoint(106.3420, 9.9347),  4326), 4, 'Trà Vinh',   'ACTIVE'),
    ('ST-001', 'Trạm Sóc Trăng', ST_SetSRID(ST_MakePoint(105.9800, 9.6039),  4326), 1, 'Sóc Trăng',  'ACTIVE'),
    ('CM-001', 'Trạm Cà Mau',    ST_SetSRID(ST_MakePoint(105.1500, 9.1769),  4326), 5, 'Cà Mau',     'ACTIVE');

INSERT INTO devices (station_id, device_code, name, device_type, manufacturer, status, installed_at) VALUES
    (1, 'DEV-CT01', 'Gateway Cần Thơ 01', 'Gateway', 'MekongIoT', 'ONLINE', NOW() - INTERVAL '30 days'),
    (3, 'DEV-BT01', 'Gateway Bến Tre 01', 'Gateway', 'MekongIoT', 'ONLINE', NOW() - INTERVAL '30 days');

INSERT INTO sensors (device_id, sensor_code, name, metric_type, unit, status) VALUES
    (1, 'SEN-CT01-SAL', 'Cảm biến độ mặn CT', 'salinity', '‰', 'ACTIVE'),
    (2, 'SEN-BT01-SAL', 'Cảm biến độ mặn BT', 'salinity', '‰', 'ACTIVE');

INSERT INTO roles (name, description) VALUES
    ('ROLE_ADMIN', 'Quản trị viên hệ thống'),
    ('ROLE_OPERATOR', 'Cán bộ vận hành trạm'),
    ('ROLE_USER', 'Người dùng / Nông dân xem dữ liệu');
