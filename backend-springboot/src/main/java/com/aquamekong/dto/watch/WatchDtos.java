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
     * Tình hình của trạm so với ngưỡng.
     *
     * @param latestSalinity  số đo mới nhất, null khi không có hoặc đã cũ hơn 3 ngày
     * @param firstExceedDate ngày đầu tiên dự báo vượt ngưỡng (từ hôm nay), null = không vượt
     * @param forecastMax     độ mặn dự báo cao nhất từ hôm nay, null = chưa có dự báo
     * @param exceeding       số đo mới nhất hoặc dự báo vượt ngưỡng
     */
    public record Outlook(Double latestSalinity, OffsetDateTime latestAt, LocalDate firstExceedDate,
                          Double forecastMax, boolean exceeding) {
    }
}
