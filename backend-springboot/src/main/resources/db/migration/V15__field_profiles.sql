-- ============================================================
-- AquaMekong — V15: hồ sơ ruộng của người dùng
-- ============================================================
-- Người dùng khai một lần cho mỗi ruộng: trạm gần nhất (chọn bằng GPS trên máy, toạ độ không gửi lên máy chủ),
-- cây và giống kèm số ngày của giống, ngày gieo sạ / ngày trồng, diện tích, ao trữ nước ngọt và dung tích ao.
-- Một tài khoản có thể có nhiều ruộng. Lưu hồ sơ thì app tự theo dõi trạm đó với ngưỡng theo cây và giai đoạn.
CREATE TABLE field_profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(60)   NOT NULL,
    -- Trạm bị xoá thì hồ sơ còn, người dùng chọn lại trạm
    station_id      BIGINT        REFERENCES stations(id) ON DELETE SET NULL,
    crop_id         BIGINT        NOT NULL REFERENCES crops(id),
    variety         VARCHAR(60),
    -- Số ngày của giống (từ gieo tới thu hoạch), dùng tính giai đoạn cây; NULL với cây không chia giai đoạn
    variety_days    INT           CHECK (variety_days BETWEEN 1 AND 3650),
    planted_on      DATE,
    area_ha         DOUBLE PRECISION CHECK (area_ha > 0),
    has_pond        BOOLEAN       NOT NULL DEFAULT FALSE,
    pond_volume_m3  DOUBLE PRECISION CHECK (pond_volume_m3 > 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CHECK (has_pond OR pond_volume_m3 IS NULL)
);

CREATE INDEX idx_field_profiles_user ON field_profiles (user_id);

-- Theo dõi tạo từ hồ sơ ruộng: mỗi ruộng một dòng, xoá ruộng thì bỏ theo dõi. Hai ruộng cùng trạm (vd. lúa và tôm)
-- có hai dòng với ngưỡng riêng, nên UNIQUE (user, trạm) chỉ còn áp cho theo dõi đặt tay.
ALTER TABLE station_watches
    ADD COLUMN field_profile_id BIGINT UNIQUE REFERENCES field_profiles(id) ON DELETE CASCADE,
    DROP CONSTRAINT station_watches_user_id_station_id_key;

CREATE UNIQUE INDEX uq_station_watches_manual ON station_watches (user_id, station_id) WHERE field_profile_id IS NULL;
