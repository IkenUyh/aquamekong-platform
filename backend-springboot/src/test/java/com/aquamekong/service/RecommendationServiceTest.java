package com.aquamekong.service;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendationServiceTest {

    @Mock
    private MeasurementRepository measurementRepository;

    @InjectMocks
    private RecommendationService recommendationService;

    private static Measurement latest(String station, String metric, double value) {
        return Measurement.builder().station(Station.builder().name(station).build()).metricType(metric).value(value).build();
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

        assertThat(messages).containsExactly(
            "Hạn chế lấy nước tưới tại khu vực Kênh Trường Sơn (16,2‰)",
            "Hạn chế lấy nước tưới tại khu vực Kinh 3000 (7,3‰)",
            "Hạn chế lấy nước tưới tại khu vực Tiểu Dừa (4,9‰)",
            "Khuyến nghị kiểm tra hệ thống cống ngăn mặn ở hạ lưu."
        );
    }

    @Test
    void safeMessageWhenNoStationIsAboveThreshold() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(latest("Kim Quy", "salinity", 3.14)));

        assertThat(recommendationService.getRecommendations())
            .extracting(RecommendationDto::getPriority)
            .containsExactly("LOW");
    }
}
