-- ============================================================
-- AquaMekong — V12: người dùng theo dõi trạm, với ngưỡng mặn riêng (theo loại cây)
-- ============================================================

-- Mỗi dòng: một tài khoản theo dõi một trạm. Sáng nào dự báo 7 ngày tới (hoặc số đo mới nhất)
-- vượt threshold thì báo cho các thiết bị của tài khoản; forecast_exceeding giữ trạng thái lần báo trước
-- để chỉ báo khi đổi (vượt -> dưới ngưỡng và ngược lại), không báo lặp mỗi ngày.
-- Tài khoản đã theo dõi ít nhất một trạm thì chỉ nhận cảnh báo đo được của các trạm đó.
CREATE TABLE station_watches (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id         BIGINT        NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    threshold          DOUBLE PRECISION NOT NULL CHECK (threshold > 0 AND threshold <= 40),
    crop               VARCHAR(30),
    forecast_exceeding BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, station_id)
);

CREATE INDEX idx_station_watches_station ON station_watches (station_id);
