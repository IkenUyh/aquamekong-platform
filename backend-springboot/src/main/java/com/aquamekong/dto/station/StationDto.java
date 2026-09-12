package com.aquamekong.dto.station;

import com.aquamekong.entity.enums.StationStatus;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationDto {

    private Long id;
    private Long riverId;
    private String riverName;
    private String code;
    private String name;
    private Double longitude;
    private Double latitude;
    private String province;
    private StationStatus status;

    // Telemetry fields for dashboard display
    private Double latestSalinity;
    private Double latestWaterLevel;
    private Double latestFlowRate;
    private String salinityLevel;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
