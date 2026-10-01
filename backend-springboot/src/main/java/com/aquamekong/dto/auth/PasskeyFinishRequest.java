package com.aquamekong.dto.auth;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * @param credential PublicKeyCredential dạng JSON chuẩn WebAuthn (id, rawId, response, type...)
 * @param name       tên gợi nhớ khi tạo passkey (vd. "Điện thoại của tôi"); bỏ qua khi đăng nhập
 */
public record PasskeyFinishRequest(@NotBlank String requestId, @NotNull JsonNode credential, @Size(max = 100) String name) {
}
