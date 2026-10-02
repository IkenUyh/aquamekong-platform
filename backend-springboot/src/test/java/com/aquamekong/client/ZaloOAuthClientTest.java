package com.aquamekong.client;

import com.aquamekong.security.ExternalProfile;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class ZaloOAuthClientTest {

    private static final String VERIFIER = "v".repeat(43);
    /** Zalo thật trả Content-Type text/json */
    private static final MediaType TEXT_JSON = MediaType.parseMediaType("text/json;charset=utf-8");
    private MockRestServiceServer server;
    private ZaloOAuthClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new ZaloOAuthClient(builder.build(), new ObjectMapper(), "app-1", "secret-1");
    }

    @Test
    void exchangesCodeWithSecretThenReadsProfile() {
        server.expect(requestTo(ZaloOAuthClient.TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("secret_key", "secret-1"))
                .andExpect(content().formDataContains(java.util.Map.of(
                        "app_id", "app-1", "code", "the-code", "code_verifier", VERIFIER, "grant_type", "authorization_code")))
                .andRespond(withSuccess("{\"access_token\":\"at\",\"refresh_token\":\"rt\",\"expires_in\":\"3600\"}", TEXT_JSON));
        server.expect(requestTo(ZaloOAuthClient.PROFILE_URL))
                .andExpect(header("access_token", "at"))
                .andRespond(withSuccess("{\"id\":\"5001\",\"name\":\"Nguyễn Văn An\",\"error\":0,\"message\":\"Success\"}", TEXT_JSON));

        ExternalProfile p = client.exchange("the-code", VERIFIER);

        assertThat(p.provider()).isEqualTo("zalo");
        assertThat(p.subject()).isEqualTo("5001");
        assertThat(p.name()).isEqualTo("Nguyễn Văn An");
        assertThat(p.email()).isNull();
        server.verify();
    }

    @Test
    void rejectedCodeIsBadCredentials() {
        // Zalo trả lỗi bằng HTTP 200
        server.expect(requestTo(ZaloOAuthClient.TOKEN_URL))
                .andRespond(withSuccess("{\"error\":-14019,\"error_name\":\"Invalid code verifier\"}", TEXT_JSON));

        assertThatThrownBy(() -> client.exchange("bad", VERIFIER)).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void profileErrorIsBadCredentials() {
        server.expect(requestTo(ZaloOAuthClient.TOKEN_URL))
                .andRespond(withSuccess("{\"access_token\":\"at\"}", TEXT_JSON));
        server.expect(requestTo(ZaloOAuthClient.PROFILE_URL))
                .andRespond(withSuccess("{\"error\":452,\"message\":\"Access token is invalid\"}", TEXT_JSON));

        assertThatThrownBy(() -> client.exchange("c", VERIFIER)).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void zaloDownIsBadCredentialsWithoutLeakingDetails() {
        server.expect(requestTo(ZaloOAuthClient.TOKEN_URL)).andRespond(withServerError());

        assertThatThrownBy(() -> client.exchange("c", VERIFIER))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("Không kết nối được Zalo");
    }

    @Test
    void disabledUnlessBothIdAndSecretAreSet() {
        var noSecret = new ZaloOAuthClient(RestClient.create(), new ObjectMapper(), "app-1", "");
        assertThat(noSecret.isEnabled()).isFalse();
        assertThat(noSecret.getAppId()).isNull();
        assertThatThrownBy(() -> noSecret.exchange("c", VERIFIER)).isInstanceOf(IllegalArgumentException.class);
        assertThat(client.getAppId()).isEqualTo("app-1");
    }
}
