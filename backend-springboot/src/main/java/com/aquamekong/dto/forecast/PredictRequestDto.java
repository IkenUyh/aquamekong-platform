package com.aquamekong.dto.forecast;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PredictRequestDto {

    @NotNull
    private Long stationId;

    @Min(1)
    @Max(30)
    private int daysAhead = 7;
}
