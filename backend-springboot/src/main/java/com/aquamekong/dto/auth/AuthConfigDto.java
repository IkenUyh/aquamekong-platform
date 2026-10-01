package com.aquamekong.dto.auth;

/**
 * Cấu hình đăng nhập cho frontend, đọc lúc chạy (không phải build lại frontend khi đổi env).
 *
 * @param publicRead          người chưa đăng nhập được xem dữ liệu
 * @param registrationEnabled cho phép tự đăng ký (mật khẩu hoặc Google)
 * @param googleClientId      null = chưa cấu hình đăng nhập Google
 * @param zaloAppId           null = chưa cấu hình đăng nhập Zalo
 * @param passkeyEnabled      đã cấu hình WEBAUTHN_RP_ID
 */
public record AuthConfigDto(boolean publicRead, boolean registrationEnabled, String googleClientId, String zaloAppId,
                            boolean passkeyEnabled) {
}
