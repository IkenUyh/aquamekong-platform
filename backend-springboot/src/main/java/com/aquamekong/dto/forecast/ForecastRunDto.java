package com.aquamekong.dto.forecast;

import com.aquamekong.entity.enums.ForecastRunStatus;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForecastRunDto {

    private Long id;
    private String modelVersion;
    private OffsetDateTime runAt;
    private OffsetDateTime inputFrom;
    private OffsetDateTime inputTo;
    private ForecastRunStatus status;
    private OffsetDateTime createdAt;
}
