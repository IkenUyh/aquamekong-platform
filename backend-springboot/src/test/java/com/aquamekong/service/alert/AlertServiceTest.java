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

// TODO: complete edge-case assertions and verification
