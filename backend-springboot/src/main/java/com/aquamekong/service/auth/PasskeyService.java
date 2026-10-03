package com.aquamekong.service.auth;

import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.dto.auth.PasskeyDto;
import com.aquamekong.dto.auth.PasskeyOptionsDto;
import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.entity.user.User;
import com.aquamekong.entity.user.UserPasskey;
import com.aquamekong.repository.user.UserPasskeyRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.security.JpaCredentialRepository;
import com.aquamekong.security.PasskeyChallengeStore;
import com.aquamekong.service.user.UserService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yubico.webauthn.*;
import com.yubico.webauthn.data.*;
import com.yubico.webauthn.exception.AssertionFailedException;
import com.yubico.webauthn.exception.RegistrationFailedException;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Passkey (WebAuthn): tạo passkey khi đã đăng nhập, rồi đăng nhập không cần mật khẩu.
 * Dùng discoverable credential + bắt buộc xác minh người dùng (vân tay, Face ID, PIN),
 * nên một passkey đã là xác thực hai yếu tố và chống được trang lừa đảo (gắn với tên miền).
 */
@Slf4j
@Service
public class PasskeyService {

    static final int MAX_PASSKEYS_PER_USER = 10;
    private static final long TIMEOUT_MS = 120_000;

    /** null = chưa cấu hình WEBAUTHN_RP_ID */
    private final RelyingParty relyingParty;
    private final PasskeyChallengeStore challengeStore;
    private final UserRepository userRepository;
    private final UserPasskeyRepository passkeyRepository;
    private final UserService userService;
    private final AuthService authService;
    private final LoginMethodGuard loginMethodGuard;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();

    @Autowired
    public PasskeyService(JpaCredentialRepository credentialRepository,
                          @Value("${app.security.webauthn.rp-id:}") String rpId,
                          @Value("${app.security.webauthn.origins:}") String origins,
                          PasskeyChallengeStore challengeStore,
                          UserRepository userRepository,
                          UserPasskeyRepository passkeyRepository,
                          UserService userService,
                          AuthService authService,
                          LoginMethodGuard loginMethodGuard,
                          ObjectMapper objectMapper) {
        this(buildRelyingParty(credentialRepository, rpId, origins), challengeStore, userRepository, passkeyRepository,
                userService, authService, loginMethodGuard, objectMapper);
    }

    PasskeyService(RelyingParty relyingParty, PasskeyChallengeStore challengeStore, UserRepository userRepository,
                   UserPasskeyRepository passkeyRepository, UserService userService, AuthService authService,
                   LoginMethodGuard loginMethodGuard, ObjectMapper objectMapper) {
        this.relyingParty = relyingParty;
        this.challengeStore = challengeStore;
        this.userRepository = userRepository;
        this.passkeyRepository = passkeyRepository;
        this.userService = userService;
        this.authService = authService;
        this.loginMethodGuard = loginMethodGuard;
        this.objectMapper = objectMapper;
    }

    static RelyingParty buildRelyingParty(CredentialRepository repository, String rpId, String origins) {
        if (rpId == null || rpId.isBlank()) return null;
        Set<String> allowedOrigins = Arrays.stream(origins == null ? new String[0] : origins.split(","))
                .map(String::trim).filter(o -> !o.isEmpty()).collect(Collectors.toSet());
        return RelyingParty.builder()
                .identity(RelyingPartyIdentity.builder().id(rpId.trim()).name("AquaMekong").build())
                .credentialRepository(repository)
                .origins(allowedOrigins)
                .build();
    }

    public boolean isEnabled() {
        return relyingParty != null;
    }

    // ===== Tạo passkey (đã đăng nhập) =====

    @Transactional
    public PasskeyOptionsDto startRegistration(String username) {
        RelyingParty rp = requireEnabled();
        User user = findUser(username);
        if (passkeyRepository.countByUserId(user.getId()) >= MAX_PASSKEYS_PER_USER) {
            throw new IllegalArgumentException("Mỗi tài khoản có tối đa " + MAX_PASSKEYS_PER_USER + " passkey");
        }
        if (user.getWebauthnUserHandle() == null) {
            byte[] handle = new byte[32];
            random.nextBytes(handle);
            user.setWebauthnUserHandle(handle);
        }
        PublicKeyCredentialCreationOptions request = rp.startRegistration(StartRegistrationOptions.builder()
                .user(UserIdentity.builder()
                        .name(user.getUsername())
                        .displayName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                        .id(new ByteArray(user.getWebauthnUserHandle()))
                        .build())
                .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                        .residentKey(ResidentKeyRequirement.REQUIRED)
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .build())
                .timeout(TIMEOUT_MS)
                .build());
        try {
            return new PasskeyOptionsDto(challengeStore.put(request, username), publicKeyOf(request.toCredentialsCreateJson()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional
    public PasskeyDto finishRegistration(String username, String requestId, JsonNode credential, String name) {
        RelyingParty rp = requireEnabled();
        PublicKeyCredentialCreationOptions request = challengeStore.take(requestId, PublicKeyCredentialCreationOptions.class, username);
        User user = findUser(username);
        RegistrationResult result;
        try {
            result = rp.finishRegistration(FinishRegistrationOptions.builder()
                    .request(request)
                    .response(PublicKeyCredential.parseRegistrationResponseJson(credential.toString()))
                    .build());
        } catch (IOException | RegistrationFailedException e) {
            log.info("Tạo passkey thất bại cho {}: {}", username, e.getMessage());
            throw new IllegalArgumentException("Không xác minh được passkey, vui lòng thử lại");
        }
        UserPasskey saved = passkeyRepository.save(UserPasskey.builder()
                .user(user)
                .credentialId(result.getKeyId().getId().getBytes())
                .publicKeyCose(result.getPublicKeyCose().getBytes())
                .signatureCount(result.getSignatureCount())
                .name(name == null || name.isBlank() ? "Passkey " + (passkeyRepository.countByUserId(user.getId()) + 1) : name.trim())
                .build());
        return toDto(saved);
    }

    // ===== Đăng nhập (công khai) =====

    public PasskeyOptionsDto startLogin() {
        RelyingParty rp = requireEnabled();
        // Không truyền username: trình duyệt cho người dùng chọn passkey đã lưu cho tên miền này
        AssertionRequest request = rp.startAssertion(StartAssertionOptions.builder()
                .userVerification(UserVerificationRequirement.REQUIRED)
                .timeout(TIMEOUT_MS)
                .build());
        try {
            return new PasskeyOptionsDto(challengeStore.put(request, null), publicKeyOf(request.toCredentialsGetJson()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional
    public LoginResponse finishLogin(String requestId, JsonNode credential) {
        RelyingParty rp = requireEnabled();
        AssertionRequest request = challengeStore.take(requestId, AssertionRequest.class, null);
        AssertionResult result;
        try {
            result = rp.finishAssertion(FinishAssertionOptions.builder()
                    .request(request)
                    .response(PublicKeyCredential.parseAssertionResponseJson(credential.toString()))
                    .build());
        } catch (IOException | AssertionFailedException e) {
            log.info("Đăng nhập passkey thất bại: {}", e.getMessage());
            throw new BadCredentialsException("Passkey không hợp lệ hoặc đã bị xoá khỏi tài khoản");
        }
        if (!result.isSuccess()) {
            throw new BadCredentialsException("Passkey không hợp lệ hoặc đã bị xoá khỏi tài khoản");
        }
        UserPasskey passkey = passkeyRepository.findByCredentialId(result.getCredential().getCredentialId().getBytes())
                .orElseThrow(() -> new BadCredentialsException("Passkey không hợp lệ hoặc đã bị xoá khỏi tài khoản"));
        User user = passkey.getUser();
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new DisabledException("Tài khoản đã bị khoá");
        }
        passkey.setSignatureCount(result.getSignatureCount());
        passkey.setLastUsedAt(OffsetDateTime.now());
        return authService.issueToken(userService.toDto(user));
    }

    // ===== Quản lý =====

    @Transactional(readOnly = true)
    public List<PasskeyDto> list(String username) {
        return passkeyRepository.findByUserIdOrderByCreatedAtAsc(findUser(username).getId()).stream().map(PasskeyService::toDto).toList();
    }

    @Transactional
    public void delete(String username, Long passkeyId) {
        User user = findUser(username);
        UserPasskey passkey = passkeyRepository.findByIdAndUserId(passkeyId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy passkey"));
        loginMethodGuard.requireAnotherMethod(user);
        passkeyRepository.delete(passkey);
    }

    private RelyingParty requireEnabled() {
        if (relyingParty == null) {
            throw new IllegalArgumentException("Chưa cấu hình passkey (WEBAUTHN_RP_ID)");
        }
        return relyingParty;
    }

    /** toCredentials*Json() trả {"publicKey": {...}}; frontend chỉ cần phần publicKey */
    private JsonNode publicKeyOf(String credentialsJson) throws JsonProcessingException {
        return objectMapper.readTree(credentialsJson).get("publicKey");
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User không tồn tại: " + username));
    }

    private static PasskeyDto toDto(UserPasskey p) {
        return new PasskeyDto(p.getId(), p.getName(), p.getCreatedAt(), p.getLastUsedAt());
    }
}
