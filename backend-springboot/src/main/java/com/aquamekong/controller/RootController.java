package com.aquamekong.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@Tag(name = "Root", description = "Thông tin hệ thống")
public class RootController {

    @GetMapping("/")
    @Operation(summary = "Trang chủ API", description = "Trả về thông tin trạng thái API AquaMekong")
    public ResponseEntity<Map<String, Object>> root() {
        return ResponseEntity.ok(Map.of(
            "name", "AquaMekong Platform API",
            "status", "UP",
            "version", "1.0.0",
            "documentation", "/swagger-ui.html",
            "endpoints", Map.of(
                "stations", "/api/v1/stations",
                "measurements", "/api/v1/measurements/latest",
                "forecasts", "/api/v1/forecasts/runs",
                "alerts", "/api/v1/alerts"
            )
        ));
    }
}
