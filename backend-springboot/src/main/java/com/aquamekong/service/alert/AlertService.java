package com.aquamekong.service.alert;

import com.aquamekong.dto.alert.AlertDto;
import com.aquamekong.dto.alert.AlertRuleDto;
import com.aquamekong.dto.telemetry.MeasurementDto;
import com.aquamekong.entity.alert.Alert;
import com.aquamekong.entity.alert.AlertRule;
import com.aquamekong.entity.enums.AlertSeverity;
import com.aquamekong.entity.enums.AlertStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.alert.AlertRepository;
import com.aquamekong.repository.alert.AlertRuleRepository;
import com.aquamekong.repository.station.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRuleRepository alertRuleRepository;
    private final AlertRepository alertRepository;
    private final StationRepository stationRepository;

    @Transactional(readOnly = true)
    public List<AlertRuleDto> getAllRules() {
        return alertRuleRepository.findAll().stream()
                .map(this::toRuleDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AlertRuleDto> getRulesByStationId(Long stationId) {
        return alertRuleRepository.findByStationId(stationId).stream()
                .map(this::toRuleDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AlertRuleDto saveRule(AlertRuleDto dto) {
        Station station = stationRepository.findById(dto.getStationId())
                .orElseThrow(() -> new IllegalArgumentException("Station không tồn tại với ID: " + dto.getStationId()));

        AlertRule rule = AlertRule.builder()
                .id(dto.getId())
                .station(station)
                .metricType(dto.getMetricType())
                .operator(dto.getOperator() != null ? dto.getOperator() : ">")
                .threshold(dto.getThreshold())
                .severity(dto.getSeverity() != null ? dto.getSeverity() : AlertSeverity.MEDIUM)
                .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
                .build();

        AlertRule saved = alertRuleRepository.save(rule);
        return toRuleDto(saved);
    }

    @Transactional
    public void deleteRule(Long ruleId) {
        alertRuleRepository.deleteById(ruleId);
    }

    @Transactional(readOnly = true)
    public List<AlertDto> getAllAlerts() {
        return alertRepository.findAll().stream()
                .map(this::toAlertDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AlertDto> getAlertsByStationId(Long stationId) {
        return alertRepository.findByStationIdOrderByTriggeredAtDesc(stationId).stream()
                .map(this::toAlertDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AlertDto> getAlertsByStatus(AlertStatus status) {
        return alertRepository.findByStatus(status).stream()
                .map(this::toAlertDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AlertDto updateAlertStatus(Long alertId, AlertStatus status) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new IllegalArgumentException("Alert không tồn tại với ID: " + alertId));

        alert.setStatus(status);
        if (status == AlertStatus.RESOLVED) {
            alert.setResolvedAt(OffsetDateTime.now());
        }

        Alert saved = alertRepository.save(alert);
        return toAlertDto(saved);
    }

    @Transactional
    public void evaluateMeasurement(MeasurementDto measurement) {
        if (measurement == null || measurement.getStationId() == null) return;

        List<AlertRule> rules = alertRuleRepository.findByStationIdAndMetricTypeAndIsActiveTrue(
                measurement.getStationId(), measurement.getMetricType()
        );

        for (AlertRule rule : rules) {
            boolean triggered = false;
            double val = measurement.getValue();
            double thresh = rule.getThreshold();

            switch (rule.getOperator()) {
                case ">" -> triggered = val > thresh;
                case ">=" -> triggered = val >= thresh;
                case "<" -> triggered = val < thresh;
                case "<=" -> triggered = val <= thresh;
                case "==" -> triggered = val == thresh;
            }

            if (triggered) {
                Alert alert = Alert.builder()
                        .station(rule.getStation())
                        .rule(rule)
                        .metricType(measurement.getMetricType())
                        .value(val)
                        .threshold(thresh)
                        .severity(rule.getSeverity())
                        .status(AlertStatus.ACTIVE)
                        .triggeredAt(measurement.getRecordedAt() != null ? measurement.getRecordedAt() : OffsetDateTime.now())
                        .build();

                alertRepository.save(alert);
            }
        }
    }

    public AlertRuleDto toRuleDto(AlertRule entity) {
        if (entity == null) return null;
        return AlertRuleDto.builder()
                .id(entity.getId())
                .stationId(entity.getStation() != null ? entity.getStation().getId() : null)
                .stationCode(entity.getStation() != null ? entity.getStation().getCode() : null)
                .stationName(entity.getStation() != null ? entity.getStation().getName() : null)
                .metricType(entity.getMetricType())
                .operator(entity.getOperator())
                .threshold(entity.getThreshold())
                .severity(entity.getSeverity())
                .isActive(entity.getIsActive())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public AlertDto toAlertDto(Alert entity) {
        if (entity == null) return null;
        return AlertDto.builder()
                .id(entity.getId())
                .stationId(entity.getStation() != null ? entity.getStation().getId() : null)
                .stationCode(entity.getStation() != null ? entity.getStation().getCode() : null)
                .stationName(entity.getStation() != null ? entity.getStation().getName() : null)
                .ruleId(entity.getRule() != null ? entity.getRule().getId() : null)
                .metricType(entity.getMetricType())
                .value(entity.getValue())
                .threshold(entity.getThreshold())
                .severity(entity.getSeverity())
                .status(entity.getStatus())
                .triggeredAt(entity.getTriggeredAt())
                .resolvedAt(entity.getResolvedAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
