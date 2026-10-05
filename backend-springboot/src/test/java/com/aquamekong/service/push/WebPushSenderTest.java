package com.aquamekong.service.push;

import com.aquamekong.entity.user.PushSubscription;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

class WebPushSenderTest {

    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

    private KeyPair vapid;
    private MockRestServiceServer server;
    private WebPushSender sender;

    @BeforeEach
    void setUp() throws Exception {
        vapid = newKeyPair();
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        sender = new WebPushSender(builder.build(), b64(WebPushSender.encodePoint((ECPublicKey) vapid.getPublic())),
                b64(unsigned32(((ECPrivateKey) vapid.getPrivate()).getS())), "mailto:ops@example.com");
    }

    @Test
    void encryptedPayloadDecryptsWithBrowserKeys() throws Exception {
        KeyPair browser = newKeyPair();
        byte[] authSecret = "0123456789abcdef".getBytes(StandardCharsets.US_ASCII);
        byte[] payload = "{\"title\":\"Cảnh báo\"}".getBytes(StandardCharsets.UTF_8);

        byte[] body = WebPushSender.encrypt(payload, WebPushSender.encodePoint((ECPublicKey) browser.getPublic()), authSecret);

        assertThat(decrypt(body, browser, authSecret)).isEqualTo(payload);
    }

    @Test
    void sendsEncryptedBodyWithVapidAuthorization() {
        server.expect(requestTo(ENDPOINT))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Encoding", "aes128gcm"))
                .andExpect(header("TTL", "86400"))
                .andExpect(request -> {
                    String authorization = request.getHeaders().getFirst("Authorization");
                    assertThat(authorization).startsWith("vapid t=").contains(", k=" + sender.getPublicKey());
                    String jwt = authorization.substring("vapid t=".length(), authorization.indexOf(','));
                    Claims claims = Jwts.parser().verifyWith(vapid.getPublic()).build().parseSignedClaims(jwt).getPayload();
                    assertThat(claims.getAudience()).containsExactly("https://fcm.googleapis.com");
                    assertThat(claims.getSubject()).isEqualTo("mailto:ops@example.com");
                })
                .andRespond(withStatus(HttpStatus.CREATED));

        assertThat(sender.send(subscription(), "{}".getBytes(StandardCharsets.UTF_8))).isEqualTo(PushResult.SENT);
        server.verify();
    }

    @Test
    void goneWhenBrowserUnsubscribed() {
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.GONE));

        assertThat(sender.send(subscription(), "{}".getBytes(StandardCharsets.UTF_8))).isEqualTo(PushResult.GONE);
    }

    @Test
    void failedOnOtherErrors() {
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertThat(sender.send(subscription(), "{}".getBytes(StandardCharsets.UTF_8))).isEqualTo(PushResult.FAILED);
    }

    @Test
    void disabledWithoutKeys() {
        WebPushSender disabled = new WebPushSender(RestClient.create(), "", "", "mailto:x@y.z");

        assertThat(disabled.isEnabled()).isFalse();
        assertThat(disabled.getPublicKey()).isNull();
    }

    @Test
    void rejectsMismatchedKeyPair() throws Exception {
        String otherPublic = b64(WebPushSender.encodePoint((ECPublicKey) newKeyPair().getPublic()));
        String privateKey = b64(unsigned32(((ECPrivateKey) vapid.getPrivate()).getS()));

        assertThatThrownBy(() -> new WebPushSender(RestClient.create(), otherPublic, privateKey, "mailto:x@y.z"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("không cùng một cặp");
    }

    private PushSubscription subscription() {
        try {
            byte[] browserKey = WebPushSender.encodePoint((ECPublicKey) newKeyPair().getPublic());
            return PushSubscription.builder().channel(PushSubscription.Channel.WEBPUSH).endpoint(ENDPOINT)
                    .p256dh(b64(browserKey)).auth(b64(new byte[16])).build();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Giải mã như trình duyệt (RFC 8291), độc lập với code mã hoá */
    private static byte[] decrypt(byte[] body, KeyPair browser, byte[] authSecret) throws Exception {
        byte[] salt = Arrays.copyOfRange(body, 0, 16);
        int recordSize = ByteBuffer.wrap(body, 16, 4).getInt();
        int idLength = body[20];
        byte[] asPublic = Arrays.copyOfRange(body, 21, 21 + idLength);
        byte[] ciphertext = Arrays.copyOfRange(body, 21 + idLength, body.length);
        assertThat(recordSize).isEqualTo(4096);
        assertThat(idLength).isEqualTo(65);

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(browser.getPrivate());
        agreement.doPhase(WebPushSender.toPublicKey(asPublic), true);
        byte[] uaPublic = WebPushSender.encodePoint((ECPublicKey) browser.getPublic());
        byte[] info = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[]{1});
        byte[] ikm = hmac(hmac(authSecret, agreement.generateSecret()), info);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, "Content-Encoding: aes128gcm\0\1".getBytes(StandardCharsets.US_ASCII)), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, "Content-Encoding: nonce\0\1".getBytes(StandardCharsets.US_ASCII)), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] padded = cipher.doFinal(ciphertext);
        assertThat(padded[padded.length - 1]).isEqualTo((byte) 2);
        return Arrays.copyOf(padded, padded.length - 1);
    }

    private static KeyPair newKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        return generator.generateKeyPair();
    }

    private static byte[] hmac(byte[] key, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] concat(byte[]... parts) {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        for (byte[] part : parts) out.writeBytes(part);
        return out.toByteArray();
    }

    private static byte[] unsigned32(BigInteger value) {
        byte[] bytes = value.toByteArray();
        byte[] out = new byte[32];
        int copy = Math.min(bytes.length, 32);
        System.arraycopy(bytes, bytes.length - copy, out, 32 - copy, copy);
        return out;
    }

    private static String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
