package com.aquamekong.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Tự đăng ký: luôn chỉ được ROLE_USER, quyền cao hơn do admin cấp. */
public record RegisterRequest(
        @NotBlank @Pattern(regexp = "^[a-zA-Z0-9._-]{3,50}$", message = "3–50 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang")
        String username,
        @NotBlank @Email @Size(max = 100) String email,
        @Size(max = 255) String fullName,
        @NotBlank @Size(min = 8, max = 72) String password) {
}
