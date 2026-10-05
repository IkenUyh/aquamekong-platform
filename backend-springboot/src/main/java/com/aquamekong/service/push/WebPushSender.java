package com.aquamekong.service.push;

import com.aquamekong.entity.user.PushSubscription;
import io.jsonwebtoken.Jwts;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;

/**
 * Gửi Web Push tới trình duyệt (Chrome, Edge, Firefox, Safari): nội dung mã hoá theo RFC 8291 (aes128gcm),
 * xác thực máy chủ bằng VAPID (RFC 8292). Chỉ dùng crypto của JDK.
 * Khoá VAPID tạo bằng `npx web-push generate-vapid-keys`; đổi khoá thì mọi trình duyệt phải bật thông báo lại.
 */
@Slf4j
@Component
public class WebPushSender {

    private static final int RECORD_SIZE = 4096;
    private static final Duration TTL = Duration.ofHours(24);
    private static final ECParameterSpec P256 = p256();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RestClient restClient;
    private final String publicKey;
    private final ECPrivateKey privateKey;
    private final String subject;

    @Autowired
    public WebPushSender(RestClient.Builder builder,
                         @Value("${app.push.vapid.public-key:}") String publicKey,
                         @Value("${app.push.vapid.private-key:}") String privateKey,
                         @Value("${app.push.vapid.subject:mailto:admin@aquamekong.local}") String subject) {
        this(builder.requestFactory(ClientHttpRequestFactories.get(ClientHttpRequestFactorySettings.DEFAULTS
                        .withConnectTimeout(Duration.ofSeconds(5))
                        .withReadTimeout(Duration.ofSeconds(10))))
                .build(), publicKey, privateKey, subject);
    }

    /** Cho test: RestClient gắn MockRestServiceServer */
    WebPushSender(RestClient restClient, String publicKey, String privateKey, String subject) {
        this.restClient = restClient;
        this.subject = subject;
        boolean hasPublic = publicKey != null && !publicKey.isBlank();
        boolean hasPrivate = privateKey != null && !privateKey.isBlank();
        if (hasPublic != hasPrivate) {
            throw new IllegalStateException("Cần cả VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY (hoặc để trống cả hai để tắt Web Push)");
        }
        if (!hasPublic) {
            this.publicKey = null;
            this.privateKey = null;
            return;
        }
        this.publicKey = publicKey.trim();
        this.privateKey = toPrivateKey(decode(privateKey.trim()));
        try {
            checkKeyPair(this.privateKey, toPublicKey(decode(this.publicKey)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("VAPID_PUBLIC_KEY không hợp lệ: " + e.getMessage(), e);
        }
    }

    public boolean isEnabled() {
        return privateKey != null;
    }

    /** Khoá công khai VAPID cho PushManager.subscribe (applicationServerKey); null = chưa cấu hình */
    public String getPublicKey() {
        return publicKey;
    }

    public PushResult send(PushSubscription subscription, byte[] payload) {
        if (!isEnabled()) return PushResult.FAILED;
        try {
            byte[] body = encrypt(payload, decode(subscription.getP256dh()), decode(subscription.getAuth()));
            HttpStatusCode status = restClient.post()
                    .uri(URI.create(subscription.getEndpoint()))
                    .header("Authorization", "vapid t=" + vapidToken(subscription.getEndpoint()) + ", k=" + publicKey)
                    .header("Content-Encoding", "aes128gcm")
                    .header("TTL", String.valueOf(TTL.toSeconds()))
                    .header("Urgency", "high")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(body)
                    .exchange((request, response) -> response.getStatusCode());
            if (status.is2xxSuccessful()) return PushResult.SENT;
            // 404/410: trình duyệt đã huỷ đăng ký (gỡ quyền, xoá dữ liệu trang)
            if (status.value() == 404 || status.value() == 410) return PushResult.GONE;
            log.warn("Web Push bị từ chối: HTTP {} ({})", status.value(), URI.create(subscription.getEndpoint()).getHost());
            return PushResult.FAILED;
        } catch (RestClientException | GeneralSecurityException | IllegalArgumentException e) {
            log.warn("Không gửi được Web Push tới {}: {}", URI.create(subscription.getEndpoint()).getHost(), e.getMessage());
            return PushResult.FAILED;
        }
    }

    /** JWT VAPID (ES256), aud = origin của dịch vụ push */
    String vapidToken(String endpoint) {
        URI uri = URI.create(endpoint);
        return Jwts.builder()
                .header().add("typ", "JWT").and()
                .audience().single(uri.getScheme() + "://" + uri.getHost())
                .expiration(Date.from(Instant.now().plus(Duration.ofHours(12))))
                .subject(subject)
                .signWith(privateKey, Jwts.SIG.ES256)
                .compact();
    }

    /**
     * RFC 8291: ECDH với khoá của trình duyệt + auth secret -> khoá AES-128-GCM, một record duy nhất.
     * Kết quả = header (salt 16 | rs 4 | idlen 1 | khoá công khai tạm 65) + ciphertext.
     */
    static byte[] encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret) throws GeneralSecurityException {
        if (uaPublic.length != 65 || uaPublic[0] != 0x04) throw new IllegalArgumentException("p256dh không hợp lệ");
        if (authSecret.length != 16) throw new IllegalArgumentException("auth secret không hợp lệ");
        if (payload.length > RECORD_SIZE - 16 - 1 - 86) throw new IllegalArgumentException("Nội dung thông báo quá dài");

        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(P256, RANDOM);
        KeyPair ephemeral = generator.generateKeyPair();
        byte[] asPublic = encodePoint((ECPublicKey) ephemeral.getPublic());

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(ephemeral.getPrivate());
        agreement.doPhase(toPublicKey(uaPublic), true);
        byte[] ecdhSecret = agreement.generateSecret();

        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);

        byte[] prkKey = hmac(authSecret, ecdhSecret);
        byte[] ikm = hmac(prkKey, concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[]{1}));
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, "Content-Encoding: aes128gcm\0\1".getBytes(StandardCharsets.US_ASCII)), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, "Content-Encoding: nonce\0\1".getBytes(StandardCharsets.US_ASCII)), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        // 0x02: dấu kết thúc record cuối, không thêm padding
        byte[] ciphertext = cipher.doFinal(concat(payload, new byte[]{2}));

        return concat(salt, ByteBuffer.allocate(4).putInt(RECORD_SIZE).array(), new byte[]{(byte) asPublic.length}, asPublic, ciphertext);
    }

    static byte[] decode(String base64) {
        // Trình duyệt trả base64url không padding; chấp nhận cả base64 thường
        return Base64.getUrlDecoder().decode(base64.replace('+', '-').replace('/', '_').replace("=", ""));
    }

    static ECPublicKey toPublicKey(byte[] point) throws GeneralSecurityException {
        if (point.length != 65 || point[0] != 0x04) throw new InvalidKeyException("Khoá công khai P-256 phải dạng không nén 65 byte");
        ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(point, 1, 33)), new BigInteger(1, Arrays.copyOfRange(point, 33, 65)));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, P256));
    }

    static ECPrivateKey toPrivateKey(byte[] d) {
        try {
            if (d.length != 32) throw new InvalidKeyException("Khoá riêng P-256 phải 32 byte");
            return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d), P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("VAPID_PRIVATE_KEY không hợp lệ: " + e.getMessage(), e);
        }
    }

    static byte[] encodePoint(ECPublicKey key) {
        return concat(new byte[]{4}, unsigned32(key.getW().getAffineX()), unsigned32(key.getW().getAffineY()));
    }

    /** Ký thử rồi kiểm tra: phát hiện cặp khoá VAPID không khớp ngay lúc khởi động */
    private static void checkKeyPair(ECPrivateKey privateKey, ECPublicKey publicKey) {
        try {
            byte[] probe = "aquamekong".getBytes(StandardCharsets.US_ASCII);
            Signature signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(privateKey);
            signer.update(probe);
            byte[] signature = signer.sign();
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(publicKey);
            verifier.update(probe);
            if (!verifier.verify(signature)) throw new IllegalStateException("VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY không cùng một cặp");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Khoá VAPID không hợp lệ: " + e.getMessage(), e);
        }
    }

    private static byte[] unsigned32(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if (bytes.length == 32) return bytes;
        byte[] out = new byte[32];
        int copy = Math.min(bytes.length, 32);
        System.arraycopy(bytes, bytes.length - copy, out, 32 - copy, copy);
        return out;
    }

    private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) out.writeBytes(part);
        return out.toByteArray();
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            return params.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new ExceptionInInitializerError(e);
        }
    }
}
