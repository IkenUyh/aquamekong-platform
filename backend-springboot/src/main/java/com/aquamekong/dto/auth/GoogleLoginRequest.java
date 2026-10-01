package com.aquamekong.dto.auth;

import jakarta.validation.constraints.NotBlank;

/** ID token (credential) mà Google Identity Services trả về cho frontend. */
public record GoogleLoginRequest(@NotBlank String idToken) {
}
