package com.aquamekong.controller;

import com.aquamekong.service.TelemetryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
@Tag(name = "Telemetry", description = "Real-time telemetry via Server-Sent Events")
public class TelemetryController {

    private final TelemetryService telemetryService;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "SSE Stream", description = "Subscribe to real-time hydrology telemetry updates via SSE")
    public SseEmitter stream() {
        return telemetryService.subscribe();
    }

    @GetMapping("/status")
    @Operation(summary = "Connection status", description = "Số lượng SSE client đang kết nối")
    public java.util.Map<String, Object> getStatus() {
        return java.util.Map.of(
                "activeConnections", telemetryService.getActiveConnectionCount(),
                "status", "running"
        );
    }
}
