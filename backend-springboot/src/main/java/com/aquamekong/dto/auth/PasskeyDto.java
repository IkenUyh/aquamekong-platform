package com.aquamekong.dto.auth;

import java.time.OffsetDateTime;

public record PasskeyDto(Long id, String name, OffsetDateTime createdAt, OffsetDateTime lastUsedAt) {
}
