package com.aquamekong.dto.auth;

import java.time.OffsetDateTime;

/** Tài khoản ngoài đã liên kết (hiện ở trang Tài khoản). */
public record IdentityDto(String provider, String email, OffsetDateTime createdAt, OffsetDateTime lastLoginAt) {
}
