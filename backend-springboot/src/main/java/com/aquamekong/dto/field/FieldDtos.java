package com.aquamekong.dto.field;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.aquamekong.dto.watch.WatchDtos.Outlook;

import java.time.LocalDate;

/** DTO cho /api/v1/fields: hồ sơ ruộng của tài khoản đang đăng nhập. */
public final class FieldDtos {

    private FieldDtos() {
    }

    /**
     * @param stationId    trạm gần ruộng nhất (frontend chọn bằng GPS trên máy, toạ độ không gửi lên)
     * @param cropCode     mã trong bảng crops (vd. "lua")
     * @param varietyDays  số ngày của giống; bắt buộc với cây chia giai đoạn (lúa)
     * @param plantedOn    ngày gieo sạ / ngày trồng; bắt buộc với cây chia giai đoạn
     * @param pondVolumeM3 dung tích ao trữ nước ngọt (m³), chỉ khi hasPond
     * @param yieldTHa     năng suất bình thường của ruộng (tấn/ha), null = dùng mặc định của cây
     * @param priceVndKg   giá bán (đồng/kg), null = dùng mặc định của cây
     */
    public record FieldRequest(
            @NotBlank @Size(max = 60) String name,
            @NotNull Long stationId,
            @NotBlank @Size(max = 30) String cropCode,
            @Size(max = 60) String variety,
            @Min(1) @Max(3650) Integer varietyDays,
            LocalDate plantedOn,
            @DecimalMin(value = "0", inclusive = false) @DecimalMax("100000") Double areaHa,
            boolean hasPond,
            @DecimalMin(value = "0", inclusive = false) @DecimalMax("10000000") Double pondVolumeM3,
            @DecimalMin(value = "0", inclusive = false) @DecimalMax("500") Double yieldTHa,
            @DecimalMin(value = "0", inclusive = false) @DecimalMax("10000000") Double priceVndKg) {
    }

    /**
     * @param stage        giai đoạn cây hiện tại, null khi cây không có giai đoạn nào
     * @param threshold    ngưỡng (‰) của cây ở giai đoạn hiện tại, null = chưa có nguồn
     * @param minThreshold cận dưới (‰) khi cần khoảng mặn (nuôi tôm)
     * @param outlook      tình hình mặn của trạm so với ngưỡng trên, null khi không có trạm hoặc ngưỡng
     * @param mine         ruộng do tài khoản đang xem khai
     * @param notified     người khai ruộng nhận thông báo đẩy (ruộng của khách thì không)
     */
    public record FieldDto(Long id, String name, Long stationId, String stationName, String cropCode, String cropName,
                           String variety, Integer varietyDays, LocalDate plantedOn, Double areaHa,
                           boolean hasPond, Double pondVolumeM3, Double yieldTHa, Double priceVndKg, StageInfo stage,
                           Double threshold, Double minThreshold, Outlook outlook, boolean mine, boolean notified) {
    }

    /**
     * @param day            ngày thứ mấy của vụ (ngày gieo là ngày 1), null khi không có ngày gieo
     * @param beforePlanting ngày gieo còn ở phía trước
     * @param pastHarvest    đã quá số ngày của giống
     */
    public record StageInfo(String code, String name, Integer day, boolean beforePlanting, boolean pastHarvest) {
    }

    /**
     * Mức mặn cây đã chịu trong mùa nếu tưới bằng nước ở trạm của ruộng, và năng suất có thể giảm (FAO 29).
     *
     * @param seasonKind        CROP_SEASON (từ ngày gieo tới hết số ngày của giống) hoặc DRY_SEASON (01/12 – 31/05)
     * @param computedThrough   ngày cuối đã tính (hôm nay, hoặc ngày cuối mùa nếu mùa đã qua)
     * @param seasonDays        số ngày cả mùa, mẫu số khi quy mức mặn tích lũy về mức mặn hiệu dụng
     * @param daysElapsed       số ngày từ đầu mùa tới computedThrough
     * @param daysWithData      số ngày trong đó có số đo độ mặn
     * @param daysExceeded      số ngày độ mặn cao nhất vượt ngưỡng
     * @param maxSalinity       độ mặn cao nhất trong mùa (‰), null khi chưa có số đo
     * @param threshold         ngưỡng đã dùng (‰)
     * @param thresholdBasis    FAO (mức năng suất còn 100%) hoặc STAGE (ngưỡng khuyến cáo của giai đoạn, cây không có số FAO)
     * @param cumulative        Σ (mặn − ngưỡng) × hệ số nhạy của giai đoạn (‰·ngày)
     * @param effectiveSalinity ngưỡng + cumulative / seasonDays (‰), null khi chưa có số đo
     * @param yieldLossPercent  % năng suất có thể giảm, null khi cây không có số FAO hoặc chưa có số đo
     */
    public record Exposure(String seasonKind, LocalDate seasonStart, LocalDate seasonEnd, LocalDate computedThrough,
                           int seasonDays, int daysElapsed, int daysWithData, int daysExceeded,
                           Double maxSalinity, LocalDate maxOn, LocalDate lastExceededOn,
                           Double threshold, String thresholdBasis, double cumulative, Double effectiveSalinity,
                           Integer yieldLossPercent, String faoSource, Damage damage) {

        public Exposure withDamage(Damage d) {
            return new Exposure(seasonKind, seasonStart, seasonEnd, computedThrough, seasonDays, daysElapsed, daysWithData,
                    daysExceeded, maxSalinity, maxOn, lastExceededOn, threshold, thresholdBasis, cumulative,
                    effectiveSalinity, yieldLossPercent, faoSource, d);
        }
    }

    /**
     * Thiệt hại ước tính ra tiền = diện tích × % năng suất giảm × năng suất bình thường × giá bán. Số nào chưa có
     * (ruộng chưa nhập diện tích, cây chưa có năng suất/giá mặc định) thì null, kéo theo các khoản tiền null.
     *
     * @param yieldDefault   năng suất lấy mặc định của cây (người dùng chưa nhập)
     * @param priceDefault   giá lấy mặc định của cây
     * @param priceAsOf      ngày lấy giá mặc định, null khi người dùng tự nhập giá
     * @param seasonValueVnd giá trị cả vụ của ruộng (đồng)
     * @param perPercentVnd  mỗi 1% năng suất của ruộng đáng bao nhiêu (đồng)
     * @param lossVnd        thiệt hại theo % năng suất có thể giảm tới hôm nay (đồng)
     */
    public record Damage(Double areaHa, Double yieldTHa, boolean yieldDefault, Double priceVndKg, boolean priceDefault,
                         LocalDate priceAsOf, Long seasonValueVnd, Long perPercentVnd, Long lossVnd) {
    }
}
