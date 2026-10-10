package com.aquamekong.controller.watch;

import com.aquamekong.dto.watch.WatchDtos.WatchDto;
import com.aquamekong.dto.watch.WatchDtos.WatchRequest;
import com.aquamekong.service.watch.StationWatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/watches")
@RequiredArgsConstructor
@Tag(name = "Watches", description = "Trạm theo dõi của tài khoản đang đăng nhập, với ngưỡng độ mặn riêng")
public class WatchController {

    private final StationWatchService watchService;

    @GetMapping
    @Operation(summary = "Các trạm đang theo dõi, kèm số đo mới nhất và dự báo so với ngưỡng")
    public ResponseEntity<List<WatchDto>> list(Authentication authentication) {
        return ResponseEntity.ok(watchService.list(authentication.getName()));
    }

    @PostMapping
    @Operation(summary = "Theo dõi một trạm, hoặc đổi ngưỡng nếu đã theo dõi")
    public ResponseEntity<WatchDto> save(@Valid @RequestBody WatchRequest request, Authentication authentication) {
        return ResponseEntity.ok(watchService.save(authentication.getName(), request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Bỏ theo dõi")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        watchService.delete(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
