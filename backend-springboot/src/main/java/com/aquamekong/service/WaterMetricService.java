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
        
        WaterMetric m = latest.get(0);
        
        // Compute delta from 24h ago
        java.time.OffsetDateTime oneDayAgo = java.time.OffsetDateTime.now().minusHours(24);
        List<WaterMetric> pastMetrics = waterMetricRepository
            .findByStationIdAndRecordedAtBetweenOrderByRecordedAtDesc(
                m.getStation().getId(), oneDayAgo.minusHours(2), oneDayAgo.plusHours(2));
        
        Double prevRainfall = 10.0;
        Double prevFlowRate = 2500.0;
        Double prevWaterLevel = 1.3;

        if (!pastMetrics.isEmpty()) {
            WaterMetric past = pastMetrics.get(0);
            prevRainfall = past.getRainfall() != null ? past.getRainfall() : 10.0;
            prevFlowRate = past.getFlowRate() != null ? past.getFlowRate() : 2500.0;
            prevWaterLevel = past.getWaterLevel() != null ? past.getWaterLevel() : 1.3;
        }

        Double currRainfall = m.getRainfall() != null ? m.getRainfall() : 12.5;
        Double currFlowRate = m.getFlowRate() != null ? m.getFlowRate() : 2450.0;
        Double currWaterLevel = m.getWaterLevel() != null ? m.getWaterLevel() : 1.45;

        double rainfallDeltaPercent = prevRainfall > 0 ? ((currRainfall - prevRainfall) / prevRainfall) * 100 : 0;
        double flowRateDeltaPercent = prevFlowRate > 0 ? ((currFlowRate - prevFlowRate) / prevFlowRate) * 100 : 0;
        double waterLevelDelta = currWaterLevel - prevWaterLevel;

        return com.aquamekong.dto.MetricSummaryDto.builder()
                .rainfall(currRainfall)
                .rainfallDeltaPercent(Math.round(rainfallDeltaPercent * 10.0) / 10.0)
                .rainfallPeriod("24 giờ qua")
                .flowRate(currFlowRate)
                .flowRateDeltaPercent(Math.round(flowRateDeltaPercent * 10.0) / 10.0)
                .flowRateStation(m.getStation().getName())
                .waterLevel(currWaterLevel)
                .waterLevelDelta(Math.round(waterLevelDelta * 100.0) / 100.0)
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
