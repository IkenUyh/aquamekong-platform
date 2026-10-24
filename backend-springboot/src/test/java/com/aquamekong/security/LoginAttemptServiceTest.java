package com.aquamekong.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptServiceTest {

    @Test
    void locksAfterMaxFailuresAndResetsOnSuccess() {
        LoginAttemptService service = new LoginAttemptService();
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES - 1; i++) {
            service.onFailure("bob|1.2.3.4");
        }

// TODO: complete edge-case assertions and verification
