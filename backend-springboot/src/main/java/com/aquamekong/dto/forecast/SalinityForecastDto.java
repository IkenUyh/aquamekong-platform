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

    /** Thời điểm chạy mô hình của lượt dự báo này */
    private OffsetDateTime runAt;
    /** Ngày cuối có dữ liệu đầu vào (ST-GNN); dự báo tính từ ngày này, có thể trước hôm nay */
    private LocalDate dataUntil;
}
