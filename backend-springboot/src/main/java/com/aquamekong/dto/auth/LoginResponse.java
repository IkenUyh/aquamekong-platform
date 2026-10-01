package com.aquamekong.dto.auth;

import com.aquamekong.dto.user.UserDto;

public record LoginResponse(String accessToken, String tokenType, long expiresIn, UserDto user) {
}
