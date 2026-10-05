package com.aquamekong.service.push;

/** Kết quả gửi tới một thiết bị. GONE = thiết bị đã huỷ đăng ký, xoá khỏi DB. */
public enum PushResult {
    SENT,
    GONE,
    FAILED
}
