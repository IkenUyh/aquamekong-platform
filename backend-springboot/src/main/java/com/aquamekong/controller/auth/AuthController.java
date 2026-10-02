package com.aquamekong.controller.auth;

import com.aquamekong.dto.auth.*;
import com.aquamekong.dto.user.UserDto;
import com.aquamekong.service.auth.AuthService;
import com.aquamekong.service.auth.ExternalAuthService;
import com.aquamekong.service.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Đăng nhập, đăng ký, đăng nhập Google/Zalo (JWT)")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final ExternalAuthService externalAuthService;

    @GetMapping("/config")
    @Operation(summary = "Các cách đăng nhập đang bật (công khai)")
    public ResponseEntity<AuthConfigDto> config() {
        return ResponseEntity.ok(authService.config());
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập, trả về access token (Bearer)")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(authService.login(request.username(), request.password(), http.getRemoteAddr()));
    }

    @PostMapping("/register")
    @Operation(summary = "Tự đăng ký tài khoản (ROLE_USER), trả về access token")
    public ResponseEntity<LoginResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/google")
    @Operation(summary = "Đăng nhập / đăng ký bằng ID token của Google Identity Services")
    public ResponseEntity<LoginResponse> google(@Valid @RequestBody GoogleLoginRequest request) {
        return ResponseEntity.ok(externalAuthService.loginWithGoogle(request.idToken()));
    }

    @PostMapping("/zalo")
    @Operation(summary = "Đăng nhập / đăng ký bằng Zalo (code + code_verifier PKCE)")
    public ResponseEntity<LoginResponse> zalo(@Valid @RequestBody ZaloLoginRequest request) {
        return ResponseEntity.ok(externalAuthService.loginWithZalo(request.code(), request.codeVerifier()));
    }

    @GetMapping("/identities")
    @Operation(summary = "Các tài khoản ngoài đã liên kết")
    public ResponseEntity<List<IdentityDto>> identities(Authentication authentication) {
        return ResponseEntity.ok(externalAuthService.identities(authentication.getName()));
    }

    @PostMapping("/identities/google")
    @Operation(summary = "Liên kết tài khoản Google với tài khoản đang đăng nhập")
    public ResponseEntity<Void> linkGoogle(@Valid @RequestBody GoogleLoginRequest request, Authentication authentication) {
        externalAuthService.linkGoogle(authentication.getName(), request.idToken());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/identities/zalo")
    @Operation(summary = "Liên kết tài khoản Zalo với tài khoản đang đăng nhập")
    public ResponseEntity<Void> linkZalo(@Valid @RequestBody ZaloLoginRequest request, Authentication authentication) {
        externalAuthService.linkZalo(authentication.getName(), request.code(), request.codeVerifier());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/identities/{provider}")
    @Operation(summary = "Huỷ liên kết tài khoản ngoài")
    public ResponseEntity<Void> unlink(@PathVariable String provider, Authentication authentication) {
        externalAuthService.unlink(authentication.getName(), provider);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    @Operation(summary = "Thông tin người dùng đang đăng nhập")
    public ResponseEntity<UserDto> me(Authentication authentication) {
        return ResponseEntity.ok(userService.getUserByUsername(authentication.getName()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Đăng xuất", description = "Token là stateless: client xoá token; token cũ hết hạn theo JWT_EXPIRATION")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/change-password")
    @Operation(summary = "Đổi mật khẩu của chính mình (hoặc đặt lần đầu nếu tài khoản tạo bằng Google)")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request, Authentication authentication) {
        userService.changePassword(authentication.getName(), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }
}
