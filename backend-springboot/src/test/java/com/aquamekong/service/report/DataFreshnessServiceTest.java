package com.aquamekong.service.report;

import com.aquamekong.dto.report.ReportDtos.DataFreshness;
import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataFreshnessServiceTest {

    private static final ZoneOffset VN = ZoneOffset.ofHours(7);

    @Mock MeasurementRepository measurementRepository;
    @Mock StationRepository stationRepository;
    DataFreshnessService service;

    @BeforeEach
    void setUp() {
        service = new DataFreshnessService(measurementRepository, stationRepository, LocalTime.of(9, 0));
        when(stationRepository.findByStatus(StationStatus.ACTIVE)).thenReturn(List.of(station(1), station(2)));
    }

    private static Station station(long id) {
        return Station.builder().id(id).code("S" + id).name("Trạm " + id).build();
    }

    /** Số đo theo ngày gắn mốc 00:00 giờ VN */
    private static Measurement daily(long stationId, int day) {
        return Measurement.builder().station(station(stationId)).metricType("salinity")
                .recordedAt(OffsetDateTime.of(2026, 10, day, 0, 0, 0, 0, VN)).build();
    }

    private static Instant vn(int day, int hour) {
        return OffsetDateTime.of(2026, 10, day, hour, 0, 0, 0, VN).toInstant();
    }

    @Test
    void afterTheDeadlineYesterdaysDataIsExpected() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(daily(1, 8), daily(2, 7)));

        DataFreshness status = service.status(vn(9, 10));

        assertThat(status.expectedDate()).isEqualTo(LocalDate.of(2026, 10, 8));
        assertThat(status.stale()).isFalse();
        assertThat(status.latestMeasurementAt()).isEqualTo(OffsetDateTime.of(2026, 10, 8, 0, 0, 0, 0, VN));
        assertThat(status.stationsReporting()).isEqualTo(1);
        assertThat(status.activeStations()).isEqualTo(2);
    }

    @Test
    void beforeTheDeadlineTheDayBeforeIsStillEnough() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(daily(1, 7)));

        DataFreshness status = service.status(vn(9, 8));

        assertThat(status.expectedDate()).isEqualTo(LocalDate.of(2026, 10, 7));
        assertThat(status.stale()).isFalse();
    }

    @Test
    void missingYesterdayAfterTheDeadlineIsStale() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(daily(1, 7), daily(2, 7)));

        DataFreshness status = service.status(vn(9, 9));

        assertThat(status.stale()).isTrue();
        assertThat(status.stationsReporting()).isZero();
    }

    @Test
    void inactiveStationsDoNotCount() {
        Measurement fromInactive = daily(3, 8);
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(daily(1, 6), fromInactive));

        DataFreshness status = service.status(vn(9, 10));

        assertThat(status.stale()).isTrue();
        assertThat(status.latestMeasurementAt()).isEqualTo(OffsetDateTime.of(2026, 10, 6, 0, 0, 0, 0, VN));
    }

    @Test
    void noMeasurementsAtAllIsStale() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of());

        DataFreshness status = service.status(vn(9, 10));

        assertThat(status.stale()).isTrue();
        assertThat(status.latestMeasurementAt()).isNull();
    }
}
