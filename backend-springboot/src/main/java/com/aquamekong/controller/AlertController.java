package com.aquamekong.controller;

import com.aquamekong.dto.AlertDto;
import com.aquamekong.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@Tag(name = "Alerts", description = "Cảnh báo xâm nhập mặn")
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    @Operation(summary = "Cảnh báo gần đây")
    public ResponseEntity<List<AlertDto>> getRecentAlerts() {
        return ResponseEntity.ok(alertService.getRecentAlerts());
    }

    @GetMapping("/unresolved")
    @Operation(summary = "Cảnh báo chưa xử lý")
    public ResponseEntity<List<AlertDto>> getUnresolvedAlerts() {
        return ResponseEntity.ok(alertService.getUnresolvedAlerts());
    }

    @GetMapping("/count")
    @Operation(summary = "Đếm cảnh báo chưa xử lý")
    public ResponseEntity<Map<String, Long>> getUnresolvedCount() {
        return ResponseEntity.ok(Map.of("count", alertService.getUnresolvedCount()));
    }
}
