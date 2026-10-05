package com.aquamekong.service.telemetry;

import com.aquamekong.dto.telemetry.MeasurementDto;
import com.aquamekong.service.alert.AlertService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MeasurementPollerTest {

    @Mock MeasurementService measurementService;
    @Mock AlertService alertService;
    @Mock TelemetryService telemetryService;

    private MeasurementPoller poller() {
        return new MeasurementPoller(measurementService, alertService, telemetryService, Duration.ofDays(3));
    }

    private static MeasurementDto measurement(long id, OffsetDateTime recordedAt) {
        return MeasurementDto.builder().id(id).stationId(1L).metricType("salinity").value(5.0).recordedAt(recordedAt).build();
    }

    @Test
    void historicalRowsSkipAlertsAndSseButAdvanceCursor() {
        MeasurementDto old = measurement(1L, OffsetDateTime.now().minusYears(2));
        MeasurementDto fresh = measurement(2L, OffsetDateTime.now().minusHours(20));
        when(measurementService.getNewSince(eq(0L), anyInt())).thenReturn(List.of(old, fresh));

        MeasurementPoller poller = poller();
        poller.poll();

        verify(alertService, never()).evaluateMeasurement(old);
        verify(telemetryService, never()).broadcast(old);
        verify(alertService).evaluateMeasurement(fresh);
        verify(telemetryService).broadcast(fresh);

        // Lần quét sau bắt đầu sau dòng mới nhất, kể cả khi đó là dòng lịch sử
        when(measurementService.getNewSince(anyLong(), anyInt())).thenReturn(List.of());
        poller.poll();
        verify(measurementService).getNewSince(eq(2L), anyInt());
    }
}
