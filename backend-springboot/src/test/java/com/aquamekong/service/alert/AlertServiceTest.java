package com.aquamekong.service.alert;

import com.aquamekong.dto.telemetry.MeasurementDto;
import com.aquamekong.entity.alert.Alert;
import com.aquamekong.entity.alert.AlertRule;
import com.aquamekong.entity.enums.AlertSeverity;
import com.aquamekong.entity.enums.AlertStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.alert.AlertRepository;
import com.aquamekong.repository.alert.AlertRuleRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.service.push.AlertCreatedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    @Mock AlertRuleRepository alertRuleRepository;
    @Mock AlertRepository alertRepository;
    @Mock StationRepository stationRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @InjectMocks AlertService alertService;

    private final AlertRule rule = AlertRule.builder()
            .id(7L)
            .station(Station.builder().id(1L).name("Mỹ Tho").build())
            .metricType("salinity")
            .operator(">")
            .threshold(4.0)
            .severity(AlertSeverity.HIGH)
            .isActive(true)
            .build();

    private MeasurementDto measurement(double value) {
        return MeasurementDto.builder()
                .id(1L).stationId(1L).metricType("salinity").value(value)
                .recordedAt(OffsetDateTime.now())
                .build();
    }

    @Test
    void createsAlertWhenThresholdExceeded() {
        when(alertRuleRepository.findByStationIdAndMetricTypeAndIsActiveTrue(1L, "salinity")).thenReturn(List.of(rule));
        when(alertRepository.existsByRuleIdAndStatusIn(7L, AlertService.OPEN_STATUSES)).thenReturn(false);
        when(alertRepository.save(any())).thenAnswer(invocation -> {
            Alert saved = invocation.getArgument(0);
            saved.setId(42L);
            return saved;
        });

        alertService.evaluateMeasurement(measurement(5.2));

        ArgumentCaptor<Alert> alert = ArgumentCaptor.forClass(Alert.class);
        verify(alertRepository).save(alert.capture());
        assertThat(alert.getValue().getValue()).isEqualTo(5.2);
        assertThat(alert.getValue().getSeverity()).isEqualTo(AlertSeverity.HIGH);
        assertThat(alert.getValue().getStatus()).isEqualTo(AlertStatus.ACTIVE);
        verify(eventPublisher).publishEvent(new AlertCreatedEvent(42L, 1L, "Mỹ Tho", "salinity", ">", 5.2, 4.0, AlertSeverity.HIGH));
    }

    @Test
    void doesNotDuplicateWhileRuleHasOpenAlert() {
        when(alertRuleRepository.findByStationIdAndMetricTypeAndIsActiveTrue(1L, "salinity")).thenReturn(List.of(rule));
        when(alertRepository.existsByRuleIdAndStatusIn(7L, AlertService.OPEN_STATUSES)).thenReturn(true);

        alertService.evaluateMeasurement(measurement(5.2));

        verify(alertRepository, never()).save(any());
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void ignoresValuesBelowThreshold() {
        when(alertRuleRepository.findByStationIdAndMetricTypeAndIsActiveTrue(1L, "salinity")).thenReturn(List.of(rule));

        alertService.evaluateMeasurement(measurement(3.9));

        verify(alertRepository, never()).save(any());
    }
}
