-- ============================================================
-- AquaMekong — V9: đăng nhập bằng passkey (WebAuthn)
-- ============================================================

-- "user handle" WebAuthn: 32 byte ngẫu nhiên, sinh khi user tạo passkey đầu tiên.
-- Không dùng id/username để không lộ thông tin qua authenticator.
ALTER TABLE users ADD COLUMN webauthn_user_handle BYTEA UNIQUE;

CREATE TABLE user_passkeys (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id   BYTEA        NOT NULL UNIQUE,
    -- Khoá công khai dạng COSE; khoá riêng không bao giờ rời khỏi thiết bị
    public_key_cose BYTEA        NOT NULL,
    -- Bộ đếm chữ ký: giảm/không tăng bất thường -> có thể authenticator bị nhân bản
    signature_count BIGINT       NOT NULL DEFAULT 0,
    name            VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX idx_user_passkeys_user ON user_passkeys (user_id);
