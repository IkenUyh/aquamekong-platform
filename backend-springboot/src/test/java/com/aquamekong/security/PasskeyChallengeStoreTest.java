package com.aquamekong.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasskeyChallengeStoreTest {

    private final PasskeyChallengeStore store = new PasskeyChallengeStore();

    @Test
    void returnsRequestOnce() {
        String id = store.put("request", "alice");
        assertThat(store.take(id, String.class, "alice")).isEqualTo("request");
        assertThatThrownBy(() -> store.take(id, String.class, "alice")).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void registrationStartedByOneUserCannotBeFinishedByAnother() {
        String id = store.put("request", "alice");
        assertThatThrownBy(() -> store.take(id, String.class, "mallory")).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void loginChallengeCannotBeUsedAsRegistration() {
        String id = store.put("assertion", null);

// TODO: complete edge-case assertions and verification
