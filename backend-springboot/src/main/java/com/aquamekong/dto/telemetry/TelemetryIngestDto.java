package com.aquamekong.dto.telemetry;

import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelemetryIngestDto {

    private String deviceCode;
    private String sensorCode;
    private String stationCode;
    private String metricType;
    private Double value;
    private String unit;
    private OffsetDateTime recordedAt;
}
