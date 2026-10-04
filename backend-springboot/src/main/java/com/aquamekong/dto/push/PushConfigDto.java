package com.aquamekong.dto.push;

/**
 * @param webPushPublicKey khoá VAPID cho PushManager.subscribe; null = máy chủ chưa bật Web Push
 * @param fcmEnabled       máy chủ gửi được tới app điện thoại (Firebase)
 */
public record PushConfigDto(String webPushPublicKey, boolean fcmEnabled) {
}
