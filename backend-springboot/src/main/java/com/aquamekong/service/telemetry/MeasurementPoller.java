package com.aquamekong.service.telemetry;

import com.aquamekong.dto.telemetry.MeasurementDto;
import com.aquamekong.service.alert.AlertService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Quét các measurement mới (từ API ingest lẫn ML pipeline ghi thẳng vào DB),
 * đánh giá cảnh báo rồi đẩy ra SSE. Một đường xử lý duy nhất cho mọi nguồn dữ liệu.
 */
@Slf4j
@Component
public class MeasurementPoller {

    private static final int BATCH_SIZE = 1000;

    private final MeasurementService measurementService;
    private final AlertService alertService;
    private final TelemetryService telemetryService;
    /** Số đo cũ hơn mốc này (vd. nạp dữ liệu lịch sử) không tạo cảnh báo và không đẩy ra SSE */
    private final Duration maxLiveAge;

    private volatile long lastSeenId;

    public MeasurementPoller(MeasurementService measurementService,
                             AlertService alertService,
                             TelemetryService telemetryService,
                             @Value("${app.telemetry.max-live-age:P3D}") Duration maxLiveAge) {
        this.measurementService = measurementService;
        this.alertService = alertService;
        this.telemetryService = telemetryService;
        this.maxLiveAge = maxLiveAge;
    }

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
            OffsetDateTime liveCutoff = OffsetDateTime.now().minus(maxLiveAge);
            for (MeasurementDto m : batch) {
                lastSeenId = m.getId();
                if (m.getRecordedAt() != null && m.getRecordedAt().isBefore(liveCutoff)) {
                    continue;
                }
                try {
                    alertService.evaluateMeasurement(m);
                } catch (Exception e) {
                    log.error("Đánh giá cảnh báo thất bại cho measurement {}: {}", m.getId(), e.getMessage());
                }
                telemetryService.broadcast(m);
            }
        } while (batch.size() == BATCH_SIZE);
    }
}
