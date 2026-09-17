package com.aquamekong.controller;

import com.aquamekong.dto.TopStationDto;
import com.aquamekong.dto.TrendDataDto;
import com.aquamekong.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "Báo cáo thống kê")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/trend")
    @Operation(summary = "Lấy dữ liệu xu hướng", description = "Dữ liệu trung bình độ mặn/mực nước theo thời gian")
    public ResponseEntity<List<TrendDataDto>> getTrendData() {
        return ResponseEntity.ok(reportService.getTrendData());
    }

    @GetMapping("/top-stations")
    @Operation(summary = "Lấy top 5 trạm", description = "Top 5 trạm có độ mặn cao nhất")
    public ResponseEntity<List<TopStationDto>> getTopStations() {
        return ResponseEntity.ok(reportService.getTopStations());
    }
}
