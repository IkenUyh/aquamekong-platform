package com.aquamekong.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** `code` Zalo trả về trang callback + `code_verifier` (PKCE) frontend đã sinh trước khi chuyển sang Zalo. */
public record ZaloLoginRequest(@NotBlank @Size(max = 1024) String code,
                               @NotBlank @Size(min = 43, max = 128) String codeVerifier) {
}
