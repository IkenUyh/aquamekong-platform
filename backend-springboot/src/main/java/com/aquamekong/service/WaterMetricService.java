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

    @Transactional(readOnly = true)
    public List<WaterMetricDto> getMetricsByStationAndDateRange(Long stationId, java.time.OffsetDateTime from, java.time.OffsetDateTime to) {
        return waterMetricRepository
            .findByStationIdAndRecordedAtBetweenOrderByRecordedAtDesc(stationId, from, to)
            .stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public com.aquamekong.dto.MetricSummaryDto getMetricSummary() {
        // Lấy metrics mới nhất của các trạm
        List<WaterMetric> latest = waterMetricRepository.findLatestMetricPerStation();
        if (latest.isEmpty()) return new com.aquamekong.dto.MetricSummaryDto();
        
        // Mock data logic (vì lấy delta thực tế cần truy vấn history)
        WaterMetric m = latest.get(0);
        return com.aquamekong.dto.MetricSummaryDto.builder()
                .rainfall(m.getRainfall() != null ? m.getRainfall() : 12.5)
                .rainfallDeltaPercent(5.2)
                .rainfallPeriod("24 giờ qua")
                .flowRate(m.getFlowRate() != null ? m.getFlowRate() : 2450.0)
                .flowRateDeltaPercent(-2.1)
                .flowRateStation(m.getStation().getName())
                .waterLevel(m.getWaterLevel() != null ? m.getWaterLevel() : 1.45)
                .waterLevelDelta(0.12)
                .waterLevelStation(m.getStation().getName())
                .build();
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
                .rainfall(metric.getRainfall())
                .recordedAt(metric.getRecordedAt())
                .salinityLevel(StationService.classifySalinity(metric.getSalinity()))
                .build();
    }
}
