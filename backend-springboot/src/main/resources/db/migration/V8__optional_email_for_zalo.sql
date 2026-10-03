-- ============================================================
-- AquaMekong — V8: đăng nhập Zalo không cung cấp email
-- Tài khoản tạo bằng Zalo không có email. UNIQUE vẫn giữ: Postgres cho nhiều NULL.
-- ============================================================
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
