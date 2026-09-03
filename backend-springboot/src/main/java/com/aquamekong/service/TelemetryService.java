package com.aquamekong.service;

import com.aquamekong.dto.WaterMetricDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Server-Sent Events (SSE) service for real-time telemetry broadcast.
 * Manages SSE subscriber connections and periodically broadcasts
 * simulated hydrology data for demo purposes.
 */
@Slf4j
@Service
public class TelemetryService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final WaterMetricService waterMetricService;

    // Station codes for simulated data
    private static final String[] STATION_CODES = {"CT-001", "MT-001", "BT-001", "TV-001", "ST-001", "CM-001"};
    private static final String[] STATION_NAMES = {"Trạm Cần Thơ", "Trạm Mỹ Tho", "Trạm Bến Tre",
            "Trạm Trà Vinh", "Trạm Sóc Trăng", "Trạm Cà Mau"};

    public TelemetryService(WaterMetricService waterMetricService) {
        this.waterMetricService = waterMetricService;
    }

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

        // Send initial data
        try {
            List<WaterMetricDto> latestMetrics = waterMetricService.getLatestMetrics();
            emitter.send(SseEmitter.event()
                    .name("init")
                    .data(latestMetrics));
        } catch (IOException e) {
            log.error("Failed to send initial data to SSE client", e);
        }

        return emitter;
    }

    /**
     * Broadcast data to all connected SSE clients.
     */
    public void broadcast(WaterMetricDto data) {
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

    /**
     * Scheduled broadcast: every 10 seconds, simulate new telemetry data.
     * In production, this would be triggered by real IoT sensor data.
     * DISABLED: Now using real data from the Python Data Pipeline.
     */
    // @Scheduled(fixedDelayString = "${app.telemetry.broadcast-interval-ms:10000}")
    public void simulateTelemetry() {
        if (emitters.isEmpty()) return;

        ThreadLocalRandom random = ThreadLocalRandom.current();
        int stationIndex = random.nextInt(STATION_CODES.length);

        // Generate realistic-looking data per station
        double baseSalinity = switch (stationIndex) {
            case 0 -> 0.3;   // Cần Thơ — low
            case 1 -> 2.5;   // Mỹ Tho — medium
            case 2 -> 5.5;   // Bến Tre — high
            case 3 -> 3.8;   // Trà Vinh — medium-high
            case 4 -> 5.0;   // Sóc Trăng — high
            case 5 -> 9.0;   // Cà Mau — very high
            default -> 1.0;
        };

        WaterMetricDto simulatedData = WaterMetricDto.builder()
                .stationId((long) (stationIndex + 1))
                .stationCode(STATION_CODES[stationIndex])
                .stationName(STATION_NAMES[stationIndex])
                .salinity(Math.round((baseSalinity + random.nextDouble(-0.5, 0.5)) * 100.0) / 100.0)
                .waterLevel(Math.round((1.0 + random.nextDouble(-0.3, 0.3)) * 100.0) / 100.0)
                .flowRate(Math.round((3000 + random.nextDouble(-500, 500)) * 10.0) / 10.0)
                .recordedAt(OffsetDateTime.now())
                .build();

        simulatedData.setSalinityLevel(StationService.classifySalinity(simulatedData.getSalinity()));

        broadcast(simulatedData);
        log.debug("Broadcast telemetry: {} salinity={}‰", simulatedData.getStationCode(), simulatedData.getSalinity());
    }

    public int getActiveConnectionCount() {
        return emitters.size();
    }
}
