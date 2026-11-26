package com.aquamekong.dto.crop;

import java.util.List;

/** DTO cho /api/v1/crops: cây trồng / mục đích dùng nước, giai đoạn và ngưỡng mặn kèm nguồn. */
public final class CropDtos {

    private CropDtos() {
    }

    /**
     * @param category CROP, DOMESTIC_WATER hoặc AQUACULTURE
     * @param faoYield đường giảm năng suất FAO 29, null = FAO không có số cho cây này
     * @param faoNote  ghi chú về dòng FAO được dùng, hoặc vì sao không có
     */
    public record CropDto(String code, String name, String category, FaoYield faoYield, String faoNote,
                          List<StageDto> stages, Economics economics) {
    }

    /**
     * Năng suất và giá mặc định để ước thiệt hại ra tiền; null = chưa có nguồn, người dùng tự nhập.
     *
     * @param yieldTHa   tấn/ha mỗi vụ (cây lâu năm: mỗi năm)
     * @param priceVndKg đồng/kg tại ruộng/vườn
     * @param priceAsOf  ngày lấy giá
     */
    public record Economics(Double yieldTHa, String yieldSource, Double priceVndKg, String priceSource,
                            java.time.LocalDate priceAsOf) {
    }

    /**
     * Mức mặn nước tưới ứng với năng suất còn 100/90/75/50%: ECw (dS/m) đúng như FAO 29 in, và quy ra ‰ (≈ 0,64 × dS/m).
     */
    public record FaoYield(double ecw100, double ecw90, double ecw75, double ecw50,
                           double ppt100, double ppt90, double ppt75, double ppt50, String source) {
    }

    /**
     * @param durationDays số ngày cố định của giai đoạn, null khi co giãn theo giống hoặc chưa có nguồn
     * @param flexible     giai đoạn nhận phần ngày còn lại (số ngày của giống trừ các giai đoạn cố định)
     * @param maxSalinity  báo khi vượt mức này (‰), null = chưa có nguồn
     * @param minSalinity  báo khi xuống dưới mức này (‰), chỉ cho mức cần khoảng mặn
     * @param saltSensitivity hệ số nhân phần mặn vượt ngưỡng khi tính mức mặn tích lũy, 1 = như FAO 29
     */
    public record StageDto(String code, String name, int order, Integer durationDays, boolean flexible,
                           String durationSource, Double maxSalinity, Double minSalinity,
                           String thresholdSource, String thresholdNote,
                           double saltSensitivity, String sensitivitySource) {
    }
}
