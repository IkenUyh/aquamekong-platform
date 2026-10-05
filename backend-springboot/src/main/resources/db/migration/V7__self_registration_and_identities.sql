-- ============================================================
-- AquaMekong — V7: tự đăng ký + đăng nhập bằng tài khoản ngoài (Google, sau này Zalo)
-- ============================================================

-- Tài khoản tạo bằng Google chưa có mật khẩu (có thể đặt sau ở trang Tài khoản)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Email so sánh không phân biệt hoa thường khi đăng ký / liên kết
CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));

-- Mỗi dòng là một tài khoản ngoài đã liên kết với user
CREATE TABLE user_identities (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(20)  NOT NULL CHECK (provider IN ('google', 'zalo')),
    -- 'sub' của Google / id của Zalo: cố định, khác với email (email có thể đổi)
    provider_user_id VARCHAR(255) NOT NULL,
    email            VARCHAR(100),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at    TIMESTAMPTZ,
    CONSTRAINT uq_identity_provider_user UNIQUE (provider, provider_user_id),
    -- Mỗi user liên kết tối đa 1 tài khoản của mỗi nhà cung cấp
    CONSTRAINT uq_identity_user_provider UNIQUE (user_id, provider)
);
