package com.aquamekong.controller;

import com.aquamekong.dto.ForecastRequestDto;
import com.aquamekong.entity.SalinityForecast;
import com.aquamekong.service.ForecastService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/forecasts")
@RequiredArgsConstructor
@Tag(name = "Forecasts", description = "Dự báo xâm nhập mặn (ML-powered)")
public class ForecastController {

    private final ForecastService forecastService;

    @PostMapping("/predict")
    @Operation(summary = "Yêu cầu dự báo", description = "Gửi yêu cầu dự báo tới ML service và lưu kết quả")
    public ResponseEntity<List<SalinityForecast>> requestPrediction(@RequestBody ForecastRequestDto request) {
        return ResponseEntity.ok(forecastService.requestPrediction(request));
    }

    @GetMapping("/station/{stationId}")
    @Operation(summary = "Kết quả dự báo", description = "Lấy kết quả dự báo đã lưu cho 1 trạm")
    public ResponseEntity<List<SalinityForecast>> getForecastsByStation(@PathVariable Long stationId) {
        return ResponseEntity.ok(forecastService.getForecastsByStation(stationId));
    }
}
