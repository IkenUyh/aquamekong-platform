package com.aquamekong.controller.forecast;

import com.aquamekong.dto.forecast.VerificationPointDto;
import com.aquamekong.service.forecast.ForecastAccuracyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/forecasts")
@RequiredArgsConstructor
@Tag(name = "Forecast accuracy", description = "Dự báo đúng tới đâu: backtest và dự báo đã lưu so với số đo thật")
public class ForecastAccuracyController {

    private final ForecastAccuracyService accuracyService;

    @GetMapping("/accuracy")
    @Operation(summary = "Backtest mô hình đang dùng",
            description = "Sai số trung bình theo số ngày dự báo trước, so với giữ nguyên số mới nhất; toàn vùng và từng trạm. days: 30-365")
    public ResponseEntity<Map<String, Object>> accuracy(@RequestParam(defaultValue = "180") int days) {
        return ResponseEntity.ok(accuracyService.accuracy(days));
    }

    @GetMapping("/station/{stationId}/verification")
    @Operation(summary = "Dự báo đã lưu của trạm đặt cạnh số đo thật", description = "days: 1-90 (mặc định 30)")
    public ResponseEntity<List<VerificationPointDto>> verification(@PathVariable Long stationId,
                                                                   @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(accuracyService.verification(stationId, days));
    }
}
