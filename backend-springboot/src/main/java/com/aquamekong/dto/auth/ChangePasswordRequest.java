package com.aquamekong.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** currentPassword bỏ trống được khi tài khoản chưa có mật khẩu (tạo bằng Google). */
public record ChangePasswordRequest(String currentPassword, @NotBlank @Size(min = 8, max = 72) String newPassword) {
}
