package com.aquamekong.dto.push;

import com.aquamekong.entity.user.PushSubscription;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Đăng ký nhận thông báo trên một thiết bị.
 *
 * @param endpoint WEBPUSH: PushSubscription.endpoint của trình duyệt. FCM: registration token của app.
 * @param p256dh   WEBPUSH: keys.p256dh (base64url)
 * @param auth     WEBPUSH: keys.auth (base64url)
 */
public record PushSubscribeRequest(
        @NotNull PushSubscription.Channel channel,
        @NotBlank @Size(max = 1000) String endpoint,
        @Size(max = 200) String p256dh,
        @Size(max = 100) String auth) {
}
