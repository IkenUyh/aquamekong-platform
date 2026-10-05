package com.aquamekong.dto.station;

import com.aquamekong.entity.enums.StationStatus;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;

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

    /** Thời điểm số đo mới nhất của trạm (bất kỳ chỉ số nào); null = chưa có số đo */
    private OffsetDateTime lastMeasuredAt;
    /** Các chỉ số trạm đang có số đo (salinity, water_level, flow_rate...) */
    private List<String> metricTypes;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
