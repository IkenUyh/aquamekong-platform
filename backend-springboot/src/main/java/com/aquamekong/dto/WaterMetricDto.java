package com.aquamekong.dto;

import lombok.*;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WaterMetricDto {
    private Long id;
    private Long stationId;
    private String stationCode;
    private String stationName;
    private Double salinity;
    private Double waterLevel;
    private Double flowRate;
    private OffsetDateTime recordedAt;
    private String salinityLevel; // "LOW", "MEDIUM", "HIGH"
}
