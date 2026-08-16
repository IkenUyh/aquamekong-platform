package com.aquamekong.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationDto {
    private Long id;
    private String code;
    private String name;
    private Double longitude;
    private Double latitude;
    private String riverName;
    private String province;
    private String status;

    // Latest metrics (optional, populated when needed)
    private Double latestSalinity;
    private Double latestWaterLevel;
    private Double latestFlowRate;
    private String salinityLevel; // "LOW", "MEDIUM", "HIGH"
}
