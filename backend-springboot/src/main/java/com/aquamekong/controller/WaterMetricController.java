package com.aquamekong.controller;

import com.aquamekong.dto.WaterMetricDto;
import com.aquamekong.service.WaterMetricService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/metrics")
@RequiredArgsConstructor
@Tag(name = "Water Metrics", description = "Chỉ số thủy văn: độ mặn, mực nước, lưu lượng")
public class WaterMetricController {

    private final WaterMetricService waterMetricService;

    @GetMapping("/latest")
    @Operation(summary = "Chỉ số mới nhất", description = "Lấy chỉ số thủy văn mới nhất của tất cả trạm")
    public ResponseEntity<List<WaterMetricDto>> getLatestMetrics() {
        return ResponseEntity.ok(waterMetricService.getLatestMetrics());
    }

    @GetMapping("/station/{stationId}")
    @Operation(summary = "Lịch sử chỉ số", description = "Lịch sử chỉ số thủy văn của 1 trạm")
    public ResponseEntity<List<WaterMetricDto>> getMetricsByStation(@PathVariable Long stationId) {
        return ResponseEntity.ok(waterMetricService.getMetricsByStation(stationId));
    }
}
