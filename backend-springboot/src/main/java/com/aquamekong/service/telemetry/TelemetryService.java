package com.aquamekong.service.telemetry;

import com.aquamekong.dto.telemetry.MeasurementDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
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

    /** Client (EventSource) tự reconnect khi hết hạn, nên không giữ kết nối vô thời hạn. */
    private static final long EMITTER_TIMEOUT_MS = 30 * 60 * 1000L;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final MeasurementService measurementService;

    /**
     * Register a new SSE subscriber.
     */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);

        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            log.debug("SSE client disconnected. Active connections: {}", emitters.size());
        });
        emitter.onTimeout(() -> {
            emitter.complete();
            emitters.remove(emitter);
        });
        emitter.onError(e -> emitters.remove(emitter));

        emitters.add(emitter);
        log.info("New SSE client connected. Active connections: {}", emitters.size());

        // Send initial latest data
        try {
            List<MeasurementDto> latestMetrics = measurementService.getLatestPerStation();
            emitter.send(SseEmitter.event()
                    .name("init")
                    .data(latestMetrics));
        } catch (IOException | IllegalStateException e) {
            log.warn("Failed to send initial data to SSE client: {}", e.getMessage());
            emitters.remove(emitter);
            emitter.completeWithError(e);
        }

        return emitter;
    }

    /**
     * Broadcast measurement data to all connected SSE clients.
     */
    public void broadcast(MeasurementDto data) {
        sendToAll(SseEmitter.event().name("telemetry").data(data));
    }

    /**
     * Heartbeat (SSE comment) để proxy/nginx không cắt kết nối rảnh và để phát hiện client đã ngắt.
     */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        if (!emitters.isEmpty()) {
            sendToAll(SseEmitter.event().comment("ping"));
        }
    }

    private void sendToAll(SseEmitter.SseEventBuilder event) {
        List<SseEmitter> deadEmitters = new java.util.ArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(event);
            } catch (IOException | IllegalStateException e) {
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
