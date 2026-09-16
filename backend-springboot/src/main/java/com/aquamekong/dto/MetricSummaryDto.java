package com.aquamekong.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class MetricSummaryDto {
    // Lượng mưa
    private Double rainfall;
    private Double rainfallDelta;        // so với 24h trước
    private Double rainfallDeltaPercent;
    private String rainfallStation;      // trạm nào đo
    private String rainfallPeriod;       // "24 giờ qua"

    // Lưu lượng
    private Double flowRate;
    private Double flowRateDelta;
    private Double flowRateDeltaPercent;
    private String flowRateStation;

    // Mực nước
    private Double waterLevel;
    private Double waterLevelDelta;
    private Double waterLevelDeltaPercent;
    private String waterLevelStation;
}
