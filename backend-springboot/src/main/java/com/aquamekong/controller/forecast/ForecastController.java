package com.aquamekong.controller.forecast;

import com.aquamekong.dto.forecast.ForecastRunDto;
import com.aquamekong.dto.forecast.SalinityForecastDto;
import com.aquamekong.service.forecast.ForecastService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/forecasts")
@RequiredArgsConstructor
@Tag(name = "Forecasts", description = "Dự báo xâm nhập mặn (ML-powered)")
public class ForecastController {

    private final ForecastService forecastService;

    @GetMapping("/runs")
    @Operation(summary = "Danh sách các đợt chạy dự báo ML")
    public ResponseEntity<List<ForecastRunDto>> getAllRuns() {
        return ResponseEntity.ok(forecastService.getAllRuns());
    }

    @GetMapping("/runs/{id}")
    @Operation(summary = "Chi tiết lượt chạy dự báo ML")
    public ResponseEntity<ForecastRunDto> getRunById(@PathVariable Long id) {
        return ResponseEntity.ok(forecastService.getRunById(id));
    }

    @PostMapping("/runs")
    @Operation(summary = "Tạo lượt chạy dự báo ML mới")
    public ResponseEntity<ForecastRunDto> createRun(@RequestBody ForecastRunDto runDto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(forecastService.createRun(runDto));
    }

    @GetMapping("/station/{stationId}")
    @Operation(summary = "Kết quả dự báo theo trạm")
    public ResponseEntity<List<SalinityForecastDto>> getForecastsByStationId(@PathVariable Long stationId) {
        return ResponseEntity.ok(forecastService.getForecastsByStationId(stationId));
    }

    @GetMapping("/run/{runId}")
    @Operation(summary = "Kết quả dự báo theo đợt chạy (runId)")
    public ResponseEntity<List<SalinityForecastDto>> getForecastsByRunId(@PathVariable Long runId) {
        return ResponseEntity.ok(forecastService.getForecastsByRunId(runId));
    }

    @GetMapping("/station/{stationId}/range")
    @Operation(summary = "Kết quả dự báo theo trạm và khoảng ngày")
    public ResponseEntity<List<SalinityForecastDto>> getForecastsByStationAndDateRange(
            @PathVariable Long stationId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(forecastService.getForecastsByStationAndDateRange(stationId, from, to));
    }

    @PostMapping
    @Operation(summary = "Lưu kết quả dự báo độ mặn mới")
    public ResponseEntity<SalinityForecastDto> saveForecast(@RequestBody SalinityForecastDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(forecastService.saveForecast(dto));
    }
}
