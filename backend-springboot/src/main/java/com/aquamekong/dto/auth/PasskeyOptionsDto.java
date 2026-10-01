package com.aquamekong.dto.auth;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Tham số cho navigator.credentials.create/get (các trường nhị phân dạng base64url)
 * + requestId để gửi kèm ở bước finish.
 */
public record PasskeyOptionsDto(String requestId, JsonNode publicKey) {
}
