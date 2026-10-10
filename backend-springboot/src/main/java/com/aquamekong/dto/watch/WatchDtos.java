package com.aquamekong.dto.watch;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** DTO cho /api/v1/watches: trạm người dùng theo dõi, với ngưỡng độ mặn riêng. */
public final class WatchDtos {

    private WatchDtos() {
    }

    /**
     * Theo dõi một trạm, hoặc đổi ngưỡng nếu đã theo dõi.
     *
     * @param threshold ngưỡng độ mặn (‰)
     * @param crop      tên loại cây đã chọn (vd. "Lúa"), trống = tự đặt ngưỡng
     */
    public record WatchRequest(
            @NotNull Long stationId,
            @NotNull @DecimalMin("0.1") @DecimalMax("40") Double threshold,
            @Size(max = 30) String crop) {
    }

    public record WatchDto(Long id, Long stationId, String stationName, double threshold, String crop, Outlook outlook) {
    }

    /**
     * Tình hình của trạm so với ngưỡng, trong 7 ngày tới (tính cả hôm nay).
     *
     * @param latestSalinity  số đo mới nhất, null khi không có hoặc đã cũ hơn 3 ngày
     * @param firstExceedDate ngày đầu tiên dự báo vượt ngưỡng, null = không vượt
     * @param forecastMax     độ mặn dự báo cao nhất, null = chưa có dự báo
     * @param firstRiskDate   ngày đầu tiên mức có thể lên tới (mô hình rủi ro) vượt ngưỡng, null = không
     * @param riskMax         mức có thể lên tới cao nhất, null = dự báo không có mức rủi ro
     * @param riskUntil       cảnh báo nguy cơ giữ tới hết ngày này (ngày cuối từng được báo có thể vượt), null = không
     * @param exceeding       số đo mới nhất hoặc dự báo vượt ngưỡng, hoặc còn ngày có thể vượt chưa qua
     */
    public record Outlook(Double latestSalinity, OffsetDateTime latestAt, LocalDate firstExceedDate,
                          Double forecastMax, LocalDate firstRiskDate, Double riskMax, LocalDate riskUntil,
                          boolean exceeding) {
    }
}
