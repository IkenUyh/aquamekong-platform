package com.aquamekong.dto;

import lombok.*;
import java.time.OffsetDateTime;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class AlertDto {
    private Long id;
    private Long stationId;
    private String stationName;
    private String stationCode;
    private String alertType;
    private String severity;
    private String message;
    private Double thresholdValue;
    private Double actualValue;
    private Boolean isResolved;
    private OffsetDateTime createdAt;
}
