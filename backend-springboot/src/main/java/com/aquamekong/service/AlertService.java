package com.aquamekong.service;

import com.aquamekong.dto.AlertDto;
import com.aquamekong.entity.Alert;
import com.aquamekong.entity.Station;
import com.aquamekong.repository.AlertRepository;
import com.aquamekong.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository alertRepository;
    private final StationRepository stationRepository;

    // Ngưỡng cảnh báo (configurable)
    private static final double SALINITY_WARNING_THRESHOLD = 4.0;  // ‰
    private static final double SALINITY_CRITICAL_THRESHOLD = 8.0; // ‰

    /**
     * Kiểm tra metric mới và tạo alert nếu vượt ngưỡng.
     * Gọi mỗi khi có telemetry data mới.
     */
    @Transactional
    public Alert checkAndCreateAlert(Long stationId, Double salinity) {
        if (salinity == null) return null;

        Station station = stationRepository.findById(stationId).orElse(null);
        if (station == null) return null;

        if (salinity >= SALINITY_CRITICAL_THRESHOLD) {
            return createAlert(station, "SALINITY_THRESHOLD", "CRITICAL",
                String.format("Vượt ngưỡng %.0f‰ — Trạm %s: %.1f‰",
                    SALINITY_CRITICAL_THRESHOLD, station.getName(), salinity),
                SALINITY_CRITICAL_THRESHOLD, salinity);
        } else if (salinity >= SALINITY_WARNING_THRESHOLD) {
            return createAlert(station, "SALINITY_THRESHOLD", "WARNING",
                String.format("Vượt ngưỡng %.0f‰ — Trạm %s: %.1f‰",
                    SALINITY_WARNING_THRESHOLD, station.getName(), salinity),
                SALINITY_WARNING_THRESHOLD, salinity);
        }

        return null;
    }

    private Alert createAlert(Station station, String type, String severity,
                              String message, Double threshold, Double actual) {
        Alert alert = Alert.builder()
            .station(station)
            .alertType(type)
            .severity(severity)
            .message(message)
            .thresholdValue(threshold)
            .actualValue(actual)
            .build();
        log.warn("🚨 Alert created: {} — {}", severity, message);
        return alertRepository.save(alert);
    }

    public List<AlertDto> getRecentAlerts() {
        return alertRepository.findTop20ByOrderByCreatedAtDesc()
            .stream().map(this::toDto).toList();
    }

    public List<AlertDto> getUnresolvedAlerts() {
        return alertRepository.findByIsResolvedFalseOrderByCreatedAtDesc()
            .stream().map(this::toDto).toList();
    }

    public long getUnresolvedCount() {
        return alertRepository.countByIsResolvedFalse();
    }

    private AlertDto toDto(Alert alert) {
        return AlertDto.builder()
            .id(alert.getId())
            .stationId(alert.getStation().getId())
            .stationName(alert.getStation().getName())
            .stationCode(alert.getStation().getCode())
            .alertType(alert.getAlertType())
            .severity(alert.getSeverity())
            .message(alert.getMessage())
            .thresholdValue(alert.getThresholdValue())
            .actualValue(alert.getActualValue())
            .isResolved(alert.getIsResolved())
            .createdAt(alert.getCreatedAt())
            .build();
    }
}
