package com.aquamekong.service.station;

import com.aquamekong.dto.station.StationDto;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationServiceTest {

    @Mock StationRepository stationRepository;
    @Mock MeasurementRepository measurementRepository;
    @InjectMocks StationService stationService;

    private final Station station = Station.builder().id(1L).code("A1").name("Trạm A")
            .location(new GeometryFactory().createPoint(new Coordinate(105.2, 9.5))).build();

    private Measurement measurement(String metric, double value, OffsetDateTime at) {
        return Measurement.builder().station(station).metricType(metric).value(value).recordedAt(at).build();
    }

    @Test
    void metricsTheStationStoppedReportingAreNotShownAsLatest() {
        OffsetDateTime today = OffsetDateTime.parse("2026-10-07T00:00:00+07:00");
        when(stationRepository.findAll()).thenReturn(List.of(station));
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(
                measurement("salinity", 0.46, today),
                measurement("water_level", 0.9, today.minusDays(1)),
                measurement("flow_rate", 51.9, today.minusDays(38))));   // chỉ có trong bộ dữ liệu cũ

        StationDto dto = stationService.getAllStations().get(0);

        assertThat(dto.getLatestSalinity()).isEqualTo(0.46);
        assertThat(dto.getLatestWaterLevel()).isEqualTo(0.9);
        assertThat(dto.getLatestFlowRate()).isNull();
        assertThat(dto.getMetricTypes()).containsExactly("salinity", "water_level");
        assertThat(dto.getLastMeasuredAt()).isEqualTo(today);
    }
}
