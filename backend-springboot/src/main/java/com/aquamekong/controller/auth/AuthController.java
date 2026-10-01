package com.aquamekong.controller.auth;

import com.aquamekong.dto.auth.ChangePasswordRequest;
import com.aquamekong.dto.auth.LoginRequest;
import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.dto.user.UserDto;
import com.aquamekong.service.auth.AuthService;
import com.aquamekong.service.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Đăng nhập / đăng xuất (JWT)")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập, trả về access token (Bearer)")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(authService.login(request.username(), request.password(), http.getRemoteAddr()));
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
    @Operation(summary = "Đổi mật khẩu của chính mình")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request, Authentication authentication) {
        userService.changePassword(authentication.getName(), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }
}
