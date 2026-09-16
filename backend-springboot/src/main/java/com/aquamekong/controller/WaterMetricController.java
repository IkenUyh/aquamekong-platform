package com.aquamekong.controller;

import com.aquamekong.dto.MetricSummaryDto;
import com.aquamekong.dto.WaterMetricDto;
import com.aquamekong.service.WaterMetricService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/v1/metrics")
@RequiredArgsConstructor
@Tag(name = "Water Metrics", description = "Dữ liệu độ mặn và thủy văn")
public class WaterMetricController {

    private final WaterMetricService waterMetricService;

    @GetMapping("/summary")
    @Operation(summary = "Chỉ số tổng hợp có so sánh")
    public ResponseEntity<MetricSummaryDto> getMetricSummary() {
        return ResponseEntity.ok(waterMetricService.getMetricSummary());
    }

    @GetMapping("/latest")
    @Operation(summary = "Chỉ số mới nhất", description = "Lấy chỉ số thủy văn mới nhất của tất cả trạm")
    public ResponseEntity<List<WaterMetricDto>> getLatestMetrics() {
        return ResponseEntity.ok(waterMetricService.getLatestMetrics());
    }

    @GetMapping("/station/{stationId}")
    @Operation(summary = "Lịch sử chỉ số", description = "Lịch sử chỉ số thủy văn của 1 trạm")
    public ResponseEntity<List<WaterMetricDto>> getMetricsByStation(
            @PathVariable Long stationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        
        if (from != null && to != null) {
            return ResponseEntity.ok(waterMetricService.getMetricsByStationAndDateRange(stationId, from, to));
        }
        return ResponseEntity.ok(waterMetricService.getMetricsByStation(stationId));
    }
}
