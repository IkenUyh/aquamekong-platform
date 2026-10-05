package com.aquamekong.service.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class FcmSenderTest {

    private static final String TOKEN_URI = "https://oauth2.googleapis.com/token";
    private static final String SEND_URL = "https://fcm.googleapis.com/v1/projects/aquamekong-test/messages:send";
    private static final PushMessage MESSAGE = new PushMessage("Cảnh báo mức cao: Mỹ Tho", "Độ mặn 5,2‰", "/alerts", "alert-1");

    private MockRestServiceServer server;
    private FcmSender sender;

    @BeforeEach
    void setUp() throws Exception {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        sender = new FcmSender(builder.build(), new ObjectMapper(),
                Clock.fixed(Instant.parse("2026-10-04T08:00:00Z"), ZoneOffset.UTC), serviceAccountBase64());
    }

    @Test
    void exchangesServiceAccountJwtThenSendsAndCachesToken() {
        server.expect(once(), requestTo(TOKEN_URI))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().formDataContains(Map.of("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")))
                .andRespond(withSuccess("{\"access_token\":\"ya29.test\",\"expires_in\":3599}", MediaType.APPLICATION_JSON));
        for (int i = 0; i < 2; i++) {
            server.expect(requestTo(SEND_URL))
                    .andExpect(header("Authorization", "Bearer ya29.test"))
                    .andExpect(jsonPath("$.message.token").value("device-token-123456789"))
                    .andExpect(jsonPath("$.message.notification.title").value(MESSAGE.title()))
                    .andExpect(jsonPath("$.message.data.url").value("/alerts"))
                    .andRespond(withSuccess("{\"name\":\"projects/aquamekong-test/messages/1\"}", MediaType.APPLICATION_JSON));
        }

        assertThat(sender.send("device-token-123456789", MESSAGE)).isEqualTo(PushResult.SENT);
        assertThat(sender.send("device-token-123456789", MESSAGE)).isEqualTo(PushResult.SENT);
        server.verify();
    }

    @Test
    void goneWhenTokenUnregistered() {
        server.expect(requestTo(TOKEN_URI))
                .andRespond(withSuccess("{\"access_token\":\"ya29.test\",\"expires_in\":3599}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(SEND_URL))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"status\":\"NOT_FOUND\",\"details\":[{\"errorCode\":\"UNREGISTERED\"}]}}"));

        assertThat(sender.send("device-token-123456789", MESSAGE)).isEqualTo(PushResult.GONE);
    }

    @Test
    void failedWhenGoogleRejectsCredentials() {
        server.expect(requestTo(TOKEN_URI)).andRespond(withStatus(HttpStatus.BAD_REQUEST));

        assertThat(sender.send("device-token-123456789", MESSAGE)).isEqualTo(PushResult.FAILED);
    }

    @Test
    void disabledWithoutServiceAccount() {
        assertThat(new FcmSender(RestClient.create(), new ObjectMapper(), Clock.systemUTC(), "").isEnabled()).isFalse();
    }

    @Test
    void rejectsInvalidServiceAccount() {
        String notJson = Base64.getEncoder().encodeToString("không phải json".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> new FcmSender(RestClient.create(), new ObjectMapper(), Clock.systemUTC(), notJson))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("FIREBASE_SERVICE_ACCOUNT_BASE64");
    }

    private static String serviceAccountBase64() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        String pem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder().encodeToString(generator.generateKeyPair().getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n";
        String json = new ObjectMapper().writeValueAsString(Map.of(
                "type", "service_account",
                "project_id", "aquamekong-test",
                "client_email", "push@aquamekong-test.iam.gserviceaccount.com",
                "private_key", pem,
                "token_uri", TOKEN_URI));
        return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }
}
