package com.aquamekong.client;

import com.aquamekong.entity.user.UserIdentity;
import com.aquamekong.security.ExternalProfile;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

/**
 * Zalo Social API, OAuth v4 + PKCE (https://developers.zalo.me/docs/social-api/tham-khao/user-access-token-v4).
 * Frontend chuyển người dùng sang Zalo và nhận `code`; backend đổi code lấy access token bằng
 * ZALO_APP_SECRET (không bao giờ gửi xuống trình duyệt), rồi lấy id + tên. Zalo không trả email.
 */
@Slf4j
@Component
public class ZaloOAuthClient {

    static final String TOKEN_URL = "https://oauth.zaloapp.com/v4/access_token";
    static final String PROFILE_URL = "https://graph.zalo.me/v2.0/me?fields=id,name";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String appId;
    private final String appSecret;

    @Autowired
    public ZaloOAuthClient(RestClient.Builder builder,
                           ObjectMapper objectMapper,
                           @Value("${app.security.zalo.app-id:}") String appId,
                           @Value("${app.security.zalo.app-secret:}") String appSecret) {
        this(builder.requestFactory(ClientHttpRequestFactories.get(ClientHttpRequestFactorySettings.DEFAULTS
                        .withConnectTimeout(Duration.ofSeconds(5))
                        .withReadTimeout(Duration.ofSeconds(10))))
                .build(), objectMapper, appId, appSecret);
    }

    /** Cho test: RestClient gắn MockRestServiceServer */
    ZaloOAuthClient(RestClient restClient, ObjectMapper objectMapper, String appId, String appSecret) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.appId = appId == null || appId.isBlank() ? null : appId.trim();
        this.appSecret = appSecret == null || appSecret.isBlank() ? null : appSecret.trim();
    }

    public boolean isEnabled() {
        return appId != null && appSecret != null;
    }

    /** null nếu chưa cấu hình đủ ZALO_APP_ID + ZALO_APP_SECRET */
    public String getAppId() {
        return isEnabled() ? appId : null;
    }

    public ExternalProfile exchange(String code, String codeVerifier) {
        if (!isEnabled()) {
            throw new IllegalArgumentException("Chưa cấu hình đăng nhập Zalo (ZALO_APP_ID, ZALO_APP_SECRET)");
        }
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("app_id", appId);
            form.add("code", code);
            form.add("code_verifier", codeVerifier);
            form.add("grant_type", "authorization_code");
            TokenResponse token = parse(restClient.post()
                    .uri(TOKEN_URL)
                    .header("secret_key", appSecret)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class), TokenResponse.class);
            // Zalo báo lỗi bằng HTTP 200 + trường error
            if (token == null || token.accessToken() == null || token.accessToken().isBlank()) {
                log.info("Zalo từ chối code: {} {}", token == null ? null : token.error(), token == null ? null : token.errorName());
                throw invalid();
            }

            Profile profile = parse(restClient.get()
                    .uri(PROFILE_URL)
                    .header("access_token", token.accessToken())
                    .retrieve()
                    .body(String.class), Profile.class);
            if (profile == null || profile.id() == null || (profile.error() != null && profile.error() != 0)) {
                log.info("Không lấy được thông tin Zalo: {} {}", profile == null ? null : profile.error(), profile == null ? null : profile.message());
                throw invalid();
            }
            return new ExternalProfile(UserIdentity.ZALO, profile.id(), null, false, profile.name());
        } catch (RestClientException e) {
            log.warn("Gọi Zalo API thất bại: {}", e.getMessage());
            throw new BadCredentialsException("Không kết nối được Zalo, vui lòng thử lại");
        }
    }

    /** Zalo trả Content-Type "text/json" nên không dùng converter JSON mặc định của RestClient */
    private <T> T parse(String body, Class<T> type) {
        if (body == null || body.isBlank()) return null;
        try {
            return objectMapper.readValue(body, type);
        } catch (JsonProcessingException e) {
            log.warn("Zalo trả về dữ liệu không đọc được: {}", e.getOriginalMessage());
            throw new BadCredentialsException("Không kết nối được Zalo, vui lòng thử lại");
        }
    }

    private static BadCredentialsException invalid() {
        return new BadCredentialsException("Phiên đăng nhập Zalo không hợp lệ hoặc đã hết hạn, vui lòng thử lại");
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenResponse(@JsonProperty("access_token") String accessToken,
                         Integer error,
                         @JsonProperty("error_name") String errorName) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Profile(String id, String name, Integer error, String message) {
    }
}
