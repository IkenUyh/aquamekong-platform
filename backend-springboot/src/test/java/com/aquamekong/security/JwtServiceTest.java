package com.aquamekong.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-123";

    @Test
    void roundTripsUsernameAndRoles() {
        JwtService jwt = new JwtService(SECRET, Duration.ofHours(1));
        var claims = jwt.parse(jwt.issue("alice", List.of("ROLE_OPERATOR"))).orElseThrow();
        assertThat(claims.getSubject()).isEqualTo("alice");
        assertThat(JwtService.roles(claims)).containsExactly("ROLE_OPERATOR");
    }

    @Test
    void rejectsTokenSignedWithAnotherKey() {
        String token = new JwtService(SECRET, Duration.ofHours(1)).issue("alice", List.of("ROLE_ADMIN"));
        JwtService other = new JwtService("another-secret-another-secret-another-1", Duration.ofHours(1));
        assertThat(other.parse(token)).isEmpty();
    }

    @Test
    void rejectsExpiredToken() {
        JwtService jwt = new JwtService(SECRET, Duration.ofSeconds(-1));
        assertThat(jwt.parse(jwt.issue("alice", List.of()))).isEmpty();
    }

    @Test
    void rejectsShortSecret() {
        assertThatThrownBy(() -> new JwtService("short", Duration.ofHours(1))).isInstanceOf(IllegalStateException.class);
    }
}
