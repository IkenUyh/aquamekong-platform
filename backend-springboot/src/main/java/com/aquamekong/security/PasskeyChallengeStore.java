package com.aquamekong.security;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giữ challenge WebAuthn giữa bước start và finish (tối đa {@link #TTL}), dùng một lần.
 * Nằm trong bộ nhớ: đủ cho 1 instance backend; chạy nhiều instance thì cần chuyển sang Redis/DB.
 */
@Component
public class PasskeyChallengeStore {

    static final Duration TTL = Duration.ofMinutes(5);
    /** Chặn việc gọi /login/start liên tục để làm đầy bộ nhớ */
    static final int MAX_PENDING = 10_000;

    private record Pending(Object request, String username, Instant expiresAt) {
    }

    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    /** username = null cho đăng nhập (chưa biết là ai) */
    public String put(Object request, String username) {
        Instant now = Instant.now();
        pending.values().removeIf(p -> now.isAfter(p.expiresAt()));
        if (pending.size() >= MAX_PENDING) {
            throw new IllegalStateException("Quá nhiều yêu cầu passkey đang chờ");
        }
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        String id = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        pending.put(id, new Pending(request, username, now.plus(TTL)));
        return id;
    }

    /** Lấy và xoá; sai id / hết hạn / khác loại / khác người tạo -> lỗi */
    public <T> T take(String id, Class<T> type, String username) {
        Pending p = id == null ? null : pending.remove(id);
        if (p == null || Instant.now().isAfter(p.expiresAt()) || !type.isInstance(p.request())
                || !Objects.equals(p.username(), username)) {
            throw new BadCredentialsException("Phiên passkey đã hết hạn, vui lòng thử lại");
        }
        return type.cast(p.request());
    }
}
