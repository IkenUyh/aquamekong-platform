package com.aquamekong.service.telemetry;

import com.aquamekong.dto.telemetry.MeasurementDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Server-Sent Events (SSE) service for real-time telemetry broadcast.
 * Manages SSE subscriber connections and broadcasts measurements.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final MeasurementService measurementService;

    /**
     * Register a new SSE subscriber.
     */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE); // No timeout

        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            log.debug("SSE client disconnected. Active connections: {}", emitters.size());
        });
        emitter.onTimeout(() -> {
            emitter.complete();
            emitters.remove(emitter);
        });
        emitter.onError(e -> {
            emitter.completeWithError(e);
            emitters.remove(emitter);
        });

        emitters.add(emitter);
        log.info("New SSE client connected. Active connections: {}", emitters.size());

        // Send initial latest data
        try {
            List<MeasurementDto> latestMetrics = measurementService.getLatestPerStation();
            emitter.send(SseEmitter.event()
                    .name("init")
                    .data(latestMetrics));
        } catch (IOException e) {
            log.error("Failed to send initial data to SSE client", e);
        }

        return emitter;
    }

    /**
     * Broadcast measurement data to all connected SSE clients.
     */
    public void broadcast(MeasurementDto data) {
        List<SseEmitter> deadEmitters = new java.util.ArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("telemetry")
                        .data(data));
            } catch (IOException e) {
                deadEmitters.add(emitter);
            }
        }

        emitters.removeAll(deadEmitters);

        if (!deadEmitters.isEmpty()) {
            log.debug("Removed {} dead SSE connections. Active: {}", deadEmitters.size(), emitters.size());
        }
    }

    public int getActiveConnectionCount() {
        return emitters.size();
    }
}
