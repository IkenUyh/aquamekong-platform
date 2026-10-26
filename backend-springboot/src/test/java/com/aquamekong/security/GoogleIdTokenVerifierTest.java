package com.aquamekong.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Dùng khoá RSA tự sinh thay cho JWKS của Google; validator giống hệt bản chạy thật. */
class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "my-app.apps.googleusercontent.com";
    private static KeyPair keys;
    private static GoogleIdTokenVerifier verifier;

    @BeforeAll
    static void setUp() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        keys = gen.generateKeyPair();
        var decoder = NimbusJwtDecoder.withPublicKey((RSAPublicKey) keys.getPublic()).build();
        verifier = new GoogleIdTokenVerifier(CLIENT_ID, GoogleIdTokenVerifier.withGoogleValidators(decoder, CLIENT_ID));
    }

    private static String token(String issuer, String audience, Instant expiresAt, Object emailVerified) throws Exception {
        var claims = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .audience(audience)
                .subject("1234567890")
                .claim("email", "nguyen.van.a@gmail.com")
                .claim("email_verified", emailVerified)
                .claim("name", "Nguyễn Văn A")
                .issueTime(Date.from(expiresAt.minusSeconds(3600)))
                .expirationTime(Date.from(expiresAt))
                .build();
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
        jwt.sign(new RSASSASigner(keys.getPrivate()));
        return jwt.serialize();
    }

    private static Instant inOneHour() {
        return Instant.now().plusSeconds(3600);
    }

    @Test
    void acceptsValidGoogleToken() throws Exception {
        ExternalProfile p = verifier.verify(token("https://accounts.google.com", CLIENT_ID, inOneHour(), true));

        assertThat(p.provider()).isEqualTo("google");
        assertThat(p.subject()).isEqualTo("1234567890");
        assertThat(p.email()).isEqualTo("nguyen.van.a@gmail.com");
        assertThat(p.emailVerified()).isTrue();
        assertThat(p.name()).isEqualTo("Nguyễn Văn A");
    }

    @Test
    void acceptsIssuerWithoutScheme() throws Exception {
        assertThat(verifier.verify(token("accounts.google.com", CLIENT_ID, inOneHour(), "true")).emailVerified()).isTrue();
    }

    @Test
    void rejectsTokenIssuedForAnotherApp() {
        assertThatThrownBy(() -> verifier.verify(token("https://accounts.google.com", "other-app", inOneHour(), true)))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void rejectsForeignIssuer() {
        assertThatThrownBy(() -> verifier.verify(token("https://evil.example", CLIENT_ID, inOneHour(), true)))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void rejectsExpiredToken() {
        assertThatThrownBy(() -> verifier.verify(token("https://accounts.google.com", CLIENT_ID, Instant.now().minusSeconds(600), true)))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void rejectsGarbage() {
        assertThatThrownBy(() -> verifier.verify("not-a-jwt")).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void unverifiedEmailIsReported() throws Exception {
        assertThat(verifier.verify(token("https://accounts.google.com", CLIENT_ID, inOneHour(), false)).emailVerified()).isFalse();
    }

    @Test
    void disabledWithoutClientId() {
        var disabled = new GoogleIdTokenVerifier("");
        assertThat(disabled.isEnabled()).isFalse();
        assertThat(disabled.getClientId()).isNull();
        assertThatThrownBy(() -> disabled.verify("x")).isInstanceOf(IllegalArgumentException.class);
    }
}
