package com.aquamekong.security;

/** Thông tin đã xác minh từ nhà cung cấp đăng nhập ngoài. */
public record ExternalProfile(String provider, String subject, String email, boolean emailVerified, String name) {
}
