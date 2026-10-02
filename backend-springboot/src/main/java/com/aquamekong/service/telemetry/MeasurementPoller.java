package com.aquamekong.service.telemetry;

import com.aquamekong.dto.telemetry.MeasurementDto;
import com.aquamekong.service.alert.AlertService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Quét các measurement mới (từ API ingest lẫn ML pipeline ghi thẳng vào DB),
 * đánh giá cảnh báo rồi đẩy ra SSE. Một đường xử lý duy nhất cho mọi nguồn dữ liệu.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeasurementPoller {

    private static final int BATCH_SIZE = 1000;

    private final MeasurementService measurementService;
    private final AlertService alertService;
    private final TelemetryService telemetryService;

    private volatile long lastSeenId;

    @PostConstruct
    void init() {
        // Bắt đầu từ dữ liệu hiện có, không xử lý lại lịch sử khi khởi động
        lastSeenId = measurementService.getMaxId();
    }

    @Scheduled(fixedDelayString = "${app.telemetry.broadcast-interval-ms:10000}")
    public void poll() {
        List<MeasurementDto> batch;
        do {
            batch = measurementService.getNewSince(lastSeenId, BATCH_SIZE);
            for (MeasurementDto m : batch) {
                try {
                    alertService.evaluateMeasurement(m);
                } catch (Exception e) {
                    log.error("Đánh giá cảnh báo thất bại cho measurement {}: {}", m.getId(), e.getMessage());
                }
                telemetryService.broadcast(m);
                lastSeenId = m.getId();
            }
        } while (batch.size() == BATCH_SIZE);
    }
}
