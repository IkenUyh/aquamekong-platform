package com.aquamekong.dto.alert;

import com.aquamekong.entity.enums.AlertSeverity;
import com.aquamekong.entity.enums.AlertStatus;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertDto {

    private Long id;
    private Long stationId;
    private String stationCode;
    private String stationName;
    private Long ruleId;

    private String metricType;
    private Double value;
    private Double threshold;
    private AlertSeverity severity;
    private AlertStatus status;

    private OffsetDateTime triggeredAt;
    private OffsetDateTime resolvedAt;
    private OffsetDateTime createdAt;
}
