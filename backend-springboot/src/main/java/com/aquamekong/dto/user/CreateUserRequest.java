package com.aquamekong.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Tạo user — mật khẩu nằm trong body (không đưa lên query string/URL để tránh lộ qua log).
 */
public record CreateUserRequest(
        @NotBlank @Size(max = 50) String username,
        @NotBlank @Email @Size(max = 100) String email,
        @Size(max = 255) String fullName,
        @NotBlank @Size(min = 8, max = 72) String password,
        List<String> roles) {
}
