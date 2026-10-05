package com.aquamekong.dto.telemetry;

import com.aquamekong.entity.enums.QualityStatus;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeasurementDto {

    private Long id;
    private Long sensorId;
    private String sensorCode;
    private Long stationId;
    private String stationCode;
    private String stationName;

    private String metricType;
    private Double value;
    private String unit;
    private OffsetDateTime recordedAt;
    private QualityStatus qualityStatus;

    private OffsetDateTime createdAt;
}
