package com.aquamekong.dto.forecast;

import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalinityForecastDto {

    private Long id;
    private Long runId;
    private String modelVersion;
    private Long stationId;
    private String stationCode;
    private String stationName;

    private LocalDate forecastDate;
    private Double predictedSalinity;
    private Double lowerBound;
    private Double upperBound;
    private Double confidenceLevel;

    private OffsetDateTime createdAt;
}
