package com.aquamekong.service.auth;

import com.aquamekong.client.ZaloOAuthClient;
import com.aquamekong.dto.auth.IdentityDto;
import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.entity.user.User;
import com.aquamekong.entity.user.UserIdentity;
import com.aquamekong.repository.user.UserIdentityRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.security.ExternalProfile;
import com.aquamekong.security.GoogleIdTokenVerifier;
import com.aquamekong.service.user.UserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Đăng nhập / liên kết bằng tài khoản ngoài (Google, Zalo).
 *
 * Không tự gộp vào tài khoản sẵn có chỉ vì trùng email: tài khoản đăng ký bằng mật khẩu chưa
 * xác minh email, nên kẻ gian có thể đăng ký trước bằng email của nạn nhân rồi chờ nạn nhân
 * "Tiếp tục với Google" vào. Muốn dùng chung thì đăng nhập rồi liên kết ở trang Tài khoản.
 */
@Service
@RequiredArgsConstructor
public class ExternalAuthService {

    private final GoogleIdTokenVerifier googleVerifier;
    private final ZaloOAuthClient zaloClient;
    private final UserIdentityRepository identityRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final AuthService authService;

    @Transactional
    public LoginResponse loginWithGoogle(String idToken) {
        return login(googleVerifier.verify(idToken));
    }

    @Transactional
    public void linkGoogle(String username, String idToken) {
        link(username, googleVerifier.verify(idToken));
    }

    @Transactional
    public LoginResponse loginWithZalo(String code, String codeVerifier) {
        return login(zaloClient.exchange(code, codeVerifier));
    }

    @Transactional
    public void linkZalo(String username, String code, String codeVerifier) {
        link(username, zaloClient.exchange(code, codeVerifier));
    }

    @Transactional(readOnly = true)
    public List<IdentityDto> identities(String username) {
        return identityRepository.findByUserId(findUser(username).getId()).stream()
                .map(i -> new IdentityDto(i.getProvider(), i.getEmail(), i.getCreatedAt(), i.getLastLoginAt()))
                .toList();
    }

    @Transactional
    public void unlink(String username, String provider) {
        User user = findUser(username);
        if (!identityRepository.existsByUserIdAndProvider(user.getId(), provider)) {
            throw new EntityNotFoundException("Chưa liên kết tài khoản " + label(provider));
        }
        // Không để user mất hết cách đăng nhập
        if (user.getPasswordHash() == null && identityRepository.countByUserId(user.getId()) <= 1) {
            throw new IllegalArgumentException("Hãy đặt mật khẩu trước khi huỷ liên kết, nếu không bạn sẽ không đăng nhập được nữa");
        }
        identityRepository.deleteByUserIdAndProvider(user.getId(), provider);
    }

    private LoginResponse login(ExternalProfile profile) {
        var existing = identityRepository.findByProviderAndProviderUserId(profile.provider(), profile.subject());
        User user;
        if (existing.isPresent()) {
            UserIdentity identity = existing.get();
            user = identity.getUser();
            if (user.getStatus() != UserStatus.ACTIVE) {
                throw new DisabledException("Tài khoản đã bị khoá");
            }
            identity.setLastLoginAt(OffsetDateTime.now());
            if (profile.email() != null) identity.setEmail(profile.email());
        } else {
            user = registerFrom(profile);
        }
        return authService.issueToken(userService.toDto(user));
    }

    private User registerFrom(ExternalProfile profile) {
        authService.requireRegistrationEnabled();
        // Google luôn có email; Zalo thì không, tài khoản Zalo tạo mới không có email
        if (UserIdentity.GOOGLE.equals(profile.provider()) && (profile.email() == null || !profile.emailVerified())) {
            throw new BadCredentialsException("Tài khoản Google chưa xác minh email");
        }
        if (profile.email() != null && userRepository.existsByEmailIgnoreCase(profile.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết " + label(profile.provider()) + " trong trang Tài khoản.");
        }
        User user = userService.createExternalUser(profile.email(), profile.name());
        identityRepository.save(UserIdentity.builder()
                .user(user)
                .provider(profile.provider())
                .providerUserId(profile.subject())
                .email(profile.email())
                .lastLoginAt(OffsetDateTime.now())
                .build());
        return user;
    }

    private void link(String username, ExternalProfile profile) {
        User user = findUser(username);
        var existing = identityRepository.findByProviderAndProviderUserId(profile.provider(), profile.subject());
        if (existing.isPresent()) {
            if (existing.get().getUser().getId().equals(user.getId())) return;
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài khoản " + label(profile.provider()) + " này đã liên kết với người dùng khác");
        }
        if (identityRepository.existsByUserIdAndProvider(user.getId(), profile.provider())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã liên kết một tài khoản " + label(profile.provider()) + " khác, hãy huỷ liên kết trước");
        }
        identityRepository.save(UserIdentity.builder()
                .user(user)
                .provider(profile.provider())
                .providerUserId(profile.subject())
                .email(profile.email())
                .build());
    }

    private static String label(String provider) {
        return switch (provider) {
            case UserIdentity.GOOGLE -> "Google";
            case UserIdentity.ZALO -> "Zalo";
            default -> provider;
        };
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User không tồn tại: " + username));
    }
}
