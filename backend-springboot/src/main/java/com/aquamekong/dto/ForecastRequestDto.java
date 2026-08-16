package com.aquamekong.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForecastRequestDto {
    private Long stationId;
    @Builder.Default
    private Integer daysAhead = 7;
}
