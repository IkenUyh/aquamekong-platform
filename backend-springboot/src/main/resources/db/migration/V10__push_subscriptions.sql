-- ============================================================
-- AquaMekong — V10: thông báo đẩy khi có cảnh báo mới
-- ============================================================

-- Mỗi dòng là một thiết bị/trình duyệt đã bật thông báo.
-- WEBPUSH: endpoint là URL của dịch vụ push của trình duyệt, kèm khoá p256dh + auth để mã hoá nội dung.
-- FCM: endpoint là registration token Firebase của app điện thoại.
CREATE TABLE push_subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel    VARCHAR(10)   NOT NULL CHECK (channel IN ('WEBPUSH', 'FCM')),
    endpoint   VARCHAR(1000) NOT NULL UNIQUE,
    p256dh     VARCHAR(200),
    auth       VARCHAR(100),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CHECK (channel <> 'WEBPUSH' OR (p256dh IS NOT NULL AND auth IS NOT NULL))
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
