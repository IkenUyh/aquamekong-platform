package com.aquamekong.security;

import com.aquamekong.entity.user.UserIdentity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Kiểm tra ID token do Google Identity Services cấp cho frontend: chữ ký (khoá công khai
 * của Google, JWKS được cache), hạn dùng, issuer và audience = GOOGLE_CLIENT_ID của mình.
 * Không cần client secret vì backend không đổi code lấy token.
 */
@Slf4j
@Component
public class GoogleIdTokenVerifier {

    private static final String JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    private final String clientId;
    private final JwtDecoder decoder;

    @Autowired
    public GoogleIdTokenVerifier(@Value("${app.security.google.client-id:}") String clientId) {
        this.clientId = clientId == null || clientId.isBlank() ? null : clientId.trim();
        this.decoder = this.clientId == null ? null : buildDecoder(this.clientId);
    }

    /** Cho test: decoder dùng khoá tự sinh thay vì JWKS của Google */
    GoogleIdTokenVerifier(String clientId, JwtDecoder decoder) {
        this.clientId = clientId;
        this.decoder = decoder;
    }

    private static JwtDecoder buildDecoder(String clientId) {
        return withGoogleValidators(NimbusJwtDecoder.withJwkSetUri(JWKS_URI).build(), clientId);
    }

    static NimbusJwtDecoder withGoogleValidators(NimbusJwtDecoder decoder, String clientId) {
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),
                new JwtClaimValidator<Object>(JwtClaimNames.ISS, iss -> iss != null && ISSUERS.contains(iss.toString())),
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD, aud -> aud != null && aud.contains(clientId))));
        return decoder;
    }

    public boolean isEnabled() {
        return decoder != null;
    }

    /** null nếu chưa cấu hình GOOGLE_CLIENT_ID */
    public String getClientId() {
        return clientId;
    }

    public ExternalProfile verify(String idToken) {
        if (!isEnabled()) {
            throw new IllegalArgumentException("Chưa cấu hình đăng nhập Google (GOOGLE_CLIENT_ID)");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException e) {
            // Gồm cả lỗi tải JWKS của Google (mạng) -> ghi log để phân biệt với token sai
            log.info("Google ID token bị từ chối: {}", e.getMessage());
            throw new BadCredentialsException("Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn, vui lòng thử lại");
        }
        Object verified = jwt.getClaim("email_verified");
        return new ExternalProfile(
                UserIdentity.GOOGLE,
                jwt.getSubject(),
                jwt.getClaimAsString("email"),
                Boolean.TRUE.equals(verified) || "true".equals(verified),
                jwt.getClaimAsString("name"));
    }
}
