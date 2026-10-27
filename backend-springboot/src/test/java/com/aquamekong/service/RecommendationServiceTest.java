package com.aquamekong.service;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendationServiceTest {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");

    @Mock
    private MeasurementRepository measurementRepository;
    @Mock
    private SalinityForecastRepository forecastRepository;

    @InjectMocks
    private RecommendationService recommendationService;

    private long nextId = 1;

    @BeforeEach
    void noForecasts() {
        lenient().when(forecastRepository.findLatestRunForecastsBetween(any(), any())).thenReturn(List.of());
    }

    private Station station(String name) {
        return Station.builder().id(nextId++).name(name).build();
    }

    private static Measurement latest(Station station, String metric, double value) {
        return Measurement.builder().station(station).metricType(metric).value(value).recordedAt(OffsetDateTime.now()).build();
    }

    private static Measurement latest(String station, String metric, double value) {
        return latest(Station.builder().name(station).id((long) station.hashCode()).build(), metric, value);
    }

    private static SalinityForecast forecast(Station station, int daysAhead, double value, Double risk) {
        return SalinityForecast.builder().station(station).forecastDate(TODAY.plusDays(daysAhead))
                .predictedSalinity(value).riskSalinity(risk).build();
    }

    @Test
    void saltiestStationComesFirst() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(
            latest("Kinh 3000", "salinity", 7.28),
            latest("Tiểu Dừa", "salinity", 4.88),
            latest("Kim Quy", "salinity", 3.14),
            latest("Kênh Trường Sơn", "salinity", 16.16),
            latest("Kênh Trường Sơn", "water_level", 20.0)
        ));

        List<String> messages = recommendationService.getRecommendations().stream().map(RecommendationDto::getMessage).toList();

// TODO: complete edge-case assertions and verification
