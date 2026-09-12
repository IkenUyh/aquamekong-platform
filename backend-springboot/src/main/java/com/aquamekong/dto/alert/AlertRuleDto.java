package com.aquamekong.dto.alert;

import com.aquamekong.entity.enums.AlertSeverity;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertRuleDto {

    private Long id;
    private Long stationId;
    private String stationCode;
    private String stationName;

    private String metricType;
    private String operator;
    private Double threshold;
    private AlertSeverity severity;
    private Boolean isActive;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
