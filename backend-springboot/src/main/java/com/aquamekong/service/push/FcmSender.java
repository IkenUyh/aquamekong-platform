package com.aquamekong.service.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * Gửi thông báo tới app Android/iOS qua Firebase Cloud Messaging (HTTP v1 API).
 * Xác thực bằng service account: ký JWT (RS256) rồi đổi lấy access token OAuth, cache đến gần hết hạn.
 * FIREBASE_SERVICE_ACCOUNT_BASE64 = base64 của file JSON service account (Firebase Console ->
 * Project settings -> Service accounts -> Generate new private key). Trống = tắt FCM.
 */
@Slf4j
@Component
public class FcmSender {

    static final String SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final ServiceAccount account;

    private String accessToken;
    private Instant accessTokenExpiresAt = Instant.EPOCH;

    record ServiceAccount(String projectId, String clientEmail, PrivateKey privateKey, String tokenUri) {
    }

    @Autowired
    public FcmSender(RestClient.Builder builder, ObjectMapper objectMapper,
                     @Value("${app.push.fcm.service-account-base64:}") String serviceAccountBase64) {
        this(builder.requestFactory(ClientHttpRequestFactories.get(ClientHttpRequestFactorySettings.DEFAULTS
                        .withConnectTimeout(Duration.ofSeconds(5))
                        .withReadTimeout(Duration.ofSeconds(10))))
                .build(), objectMapper, Clock.systemUTC(), serviceAccountBase64);
    }

    /** Cho test: RestClient gắn MockRestServiceServer */
    FcmSender(RestClient restClient, ObjectMapper objectMapper, Clock clock, String serviceAccountBase64) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.account = serviceAccountBase64 == null || serviceAccountBase64.isBlank()
                ? null : parseServiceAccount(objectMapper, serviceAccountBase64.trim());
    }

    public boolean isEnabled() {
        return account != null;
    }

    public PushResult send(String token, PushMessage message) {
        if (!isEnabled()) return PushResult.FAILED;
        try {
            Map<String, Object> body = Map.of("message", Map.of(
                    "token", token,
                    "notification", Map.of("title", message.title(), "body", message.body()),
                    "data", Map.of("url", message.url()),
                    "android", Map.of("priority", "HIGH")));
            return restClient.post()
                    .uri("https://fcm.googleapis.com/v1/projects/{project}/messages:send", account.projectId())
                    .header("Authorization", "Bearer " + accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .exchange((request, response) -> {
                        if (response.getStatusCode().is2xxSuccessful()) return PushResult.SENT;
                        String error = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        // Token hết hiệu lực (gỡ app, xoá dữ liệu app): 404 UNREGISTERED hoặc token sai định dạng
                        if (response.getStatusCode().value() == 404 || error.contains("UNREGISTERED")
                                || error.contains("registration token is not a valid")) {
                            return PushResult.GONE;
                        }
                        log.warn("FCM từ chối: HTTP {} {}", response.getStatusCode().value(), error);
                        return PushResult.FAILED;
                    });
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Không gửi được FCM: {}", e.getMessage());
            return PushResult.FAILED;
        }
    }

    synchronized String accessToken() {
        Instant now = clock.instant();
        if (accessToken != null && now.isBefore(accessTokenExpiresAt.minus(Duration.ofMinutes(5)))) {
            return accessToken;
        }
        String assertion = Jwts.builder()
                .issuer(account.clientEmail())
                .audience().single(account.tokenUri())
                .claim("scope", SCOPE)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(Duration.ofHours(1))))
                .signWith(account.privateKey(), Jwts.SIG.RS256)
                .compact();
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
        form.add("assertion", assertion);
        JsonNode response = restClient.post()
                .uri(account.tokenUri())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(JsonNode.class);
        if (response == null || !response.hasNonNull("access_token")) {
            throw new IllegalStateException("Google không trả access token cho service account Firebase");
        }
        accessToken = response.get("access_token").asText();
        accessTokenExpiresAt = now.plusSeconds(response.path("expires_in").asLong(3600));
        return accessToken;
    }

    static ServiceAccount parseServiceAccount(ObjectMapper objectMapper, String base64) {
        try {
            JsonNode json = objectMapper.readTree(Base64.getMimeDecoder().decode(base64));
            String pem = json.path("private_key").asText();
            byte[] der = Base64.getMimeDecoder().decode(pem
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", ""));
            PrivateKey key = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
            String projectId = json.path("project_id").asText(null);
            String clientEmail = json.path("client_email").asText(null);
            if (projectId == null || clientEmail == null) throw new IllegalArgumentException("thiếu project_id hoặc client_email");
            return new ServiceAccount(projectId, clientEmail, key, json.path("token_uri").asText("https://oauth2.googleapis.com/token"));
        } catch (IOException | IllegalArgumentException | java.security.GeneralSecurityException e) {
            throw new IllegalStateException("FIREBASE_SERVICE_ACCOUNT_BASE64 không hợp lệ: " + e.getMessage(), e);
        }
    }
}
