package com.aquamekong.service;

import com.aquamekong.dto.WaterMetricDto;
import com.aquamekong.entity.WaterMetric;
import com.aquamekong.repository.WaterMetricRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WaterMetricService {

    private final WaterMetricRepository waterMetricRepository;

    /**
     * Lấy metric mới nhất cho tất cả trạm.
     */
    @Transactional(readOnly = true)
    public List<WaterMetricDto> getLatestMetrics() {
        return waterMetricRepository.findLatestMetricPerStation().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Lịch sử metrics của 1 trạm.
     */
    @Transactional(readOnly = true)
    public List<WaterMetricDto> getMetricsByStation(Long stationId) {
        return waterMetricRepository.findByStationIdOrderByRecordedAtDesc(stationId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private WaterMetricDto toDto(WaterMetric metric) {
        return WaterMetricDto.builder()
                .id(metric.getId())
                .stationId(metric.getStation().getId())
                .stationCode(metric.getStation().getCode())
                .stationName(metric.getStation().getName())
                .salinity(metric.getSalinity())
                .waterLevel(metric.getWaterLevel())
                .flowRate(metric.getFlowRate())
                .recordedAt(metric.getRecordedAt())
                .salinityLevel(StationService.classifySalinity(metric.getSalinity()))
                .build();
    }
}
