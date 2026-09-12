package com.aquamekong.dto.device;

import com.aquamekong.entity.enums.DeviceStatus;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceDto {

    private Long id;
    private Long stationId;
    private String stationName;
    private String deviceCode;
    private String name;
    private String deviceType;
    private String manufacturer;
    private String model;
    private String serialNumber;
    private DeviceStatus status;

    private OffsetDateTime installedAt;
    private OffsetDateTime lastSeenAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
