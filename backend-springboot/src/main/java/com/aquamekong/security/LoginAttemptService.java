package com.aquamekong.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Chống dò mật khẩu: sai {@value #MAX_FAILURES} lần liên tiếp (theo username + IP) thì khoá {@link #LOCK} phút.
 */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration LOCK = Duration.ofMinutes(5);

    private record Attempts(int failures, Instant lockedUntil) {
    }

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    public boolean isLocked(String key) {
        Attempts a = attempts.get(key);
        return a != null && a.lockedUntil() != null && Instant.now().isBefore(a.lockedUntil());
    }

    public void onFailure(String key) {
        attempts.compute(key, (k, a) -> {
            int failures = (a == null || (a.lockedUntil() != null && Instant.now().isAfter(a.lockedUntil()))) ? 1 : a.failures() + 1;
            return new Attempts(failures, failures >= MAX_FAILURES ? Instant.now().plus(LOCK) : null);
        });
    }

    public void onSuccess(String key) {
        attempts.remove(key);
    }
}
