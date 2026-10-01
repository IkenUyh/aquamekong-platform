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
        assertThat(service.isLocked("bob|1.2.3.4")).isFalse();

        service.onFailure("bob|1.2.3.4");
        assertThat(service.isLocked("bob|1.2.3.4")).isTrue();
        assertThat(service.isLocked("bob|5.6.7.8")).isFalse();

        service.onSuccess("bob|1.2.3.4");
        assertThat(service.isLocked("bob|1.2.3.4")).isFalse();
    }
}
