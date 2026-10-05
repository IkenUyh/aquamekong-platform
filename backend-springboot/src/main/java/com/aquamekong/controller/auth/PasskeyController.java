package com.aquamekong.controller.auth;

import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.dto.auth.PasskeyDto;
import com.aquamekong.dto.auth.PasskeyFinishRequest;
import com.aquamekong.dto.auth.PasskeyOptionsDto;
import com.aquamekong.service.auth.PasskeyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth/passkeys")
@RequiredArgsConstructor
@Tag(name = "Passkey", description = "Đăng nhập bằng passkey (WebAuthn)")
public class PasskeyController {

    private final PasskeyService passkeyService;

    @PostMapping("/login/start")
    @Operation(summary = "Bắt đầu đăng nhập bằng passkey (công khai): trả tham số cho navigator.credentials.get")
    public ResponseEntity<PasskeyOptionsDto> loginStart() {
        return ResponseEntity.ok(passkeyService.startLogin());
    }

    @PostMapping("/login/finish")
    @Operation(summary = "Kiểm tra chữ ký passkey, trả về access token")
    public ResponseEntity<LoginResponse> loginFinish(@Valid @RequestBody PasskeyFinishRequest request) {
        return ResponseEntity.ok(passkeyService.finishLogin(request.requestId(), request.credential()));
    }

    @GetMapping
    @Operation(summary = "Các passkey của tài khoản đang đăng nhập")
    public ResponseEntity<List<PasskeyDto>> list(Authentication authentication) {
        return ResponseEntity.ok(passkeyService.list(authentication.getName()));
    }

    @PostMapping("/register/start")
    @Operation(summary = "Bắt đầu tạo passkey: trả tham số cho navigator.credentials.create")
    public ResponseEntity<PasskeyOptionsDto> registerStart(Authentication authentication) {
        return ResponseEntity.ok(passkeyService.startRegistration(authentication.getName()));
    }

    @PostMapping("/register/finish")
    @Operation(summary = "Lưu passkey vừa tạo (chỉ lưu khoá công khai)")
    public ResponseEntity<PasskeyDto> registerFinish(@Valid @RequestBody PasskeyFinishRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(passkeyService.finishRegistration(authentication.getName(), request.requestId(), request.credential(), request.name()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá passkey (không cho xoá cách đăng nhập cuối cùng)")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        passkeyService.delete(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
