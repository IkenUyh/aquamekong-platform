package com.aquamekong.dto.device;

import com.aquamekong.entity.enums.SensorStatus;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SensorDto {

    private Long id;
    private Long deviceId;
    private String deviceCode;
    private String sensorCode;
    private String name;
    private String metricType;
    private String unit;
    private OffsetDateTime calibrationDate;
    private SensorStatus status;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
