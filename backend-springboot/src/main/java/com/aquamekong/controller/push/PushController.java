package com.aquamekong.controller.push;

import com.aquamekong.dto.push.PushConfigDto;
import com.aquamekong.dto.push.PushSubscribeRequest;
import com.aquamekong.dto.push.PushUnsubscribeRequest;
import com.aquamekong.service.push.PushService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/push")
@RequiredArgsConstructor
@Tag(name = "Push", description = "Thông báo đẩy khi có cảnh báo mới (trình duyệt và app điện thoại)")
public class PushController {

    private final PushService pushService;

    @GetMapping("/config")
    @Operation(summary = "Khoá VAPID cho trình duyệt và máy chủ có gửi được tới app (FCM) không")
    public ResponseEntity<PushConfigDto> config() {
        return ResponseEntity.ok(pushService.config());
    }

    @PostMapping("/subscriptions")
    @Operation(summary = "Bật thông báo trên thiết bị này cho tài khoản đang đăng nhập")
    public ResponseEntity<Void> subscribe(@Valid @RequestBody PushSubscribeRequest request, Authentication authentication) {
        pushService.subscribe(authentication.getName(), request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/unsubscribe")
    @Operation(summary = "Tắt thông báo trên thiết bị này")
    public ResponseEntity<Void> unsubscribe(@Valid @RequestBody PushUnsubscribeRequest request, Authentication authentication) {
        pushService.unsubscribe(authentication.getName(), request.endpoint());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/test")
    @Operation(summary = "Gửi thông báo thử tới mọi thiết bị của tài khoản")
    public ResponseEntity<Map<String, Integer>> test(Authentication authentication) {
        return ResponseEntity.ok(Map.of("sent", pushService.sendTest(authentication.getName())));
    }
}
