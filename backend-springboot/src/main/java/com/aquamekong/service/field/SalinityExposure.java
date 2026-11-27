package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.Exposure;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.service.crop.CropService;
import com.aquamekong.service.crop.CropStages;
import com.aquamekong.service.crop.CropStages.CurrentStage;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

/**
 * Mức mặn cây đã chịu trong mùa và năng suất có thể giảm nếu tưới bằng nước ở trạm gần ruộng.
 * <p>
 * Mùa: cây chia giai đoạn (lúa) tính từ ngày gieo tới hết số ngày của giống; cây không chia giai đoạn (cây ăn quả,
 * mía, rau) tính theo mùa khô 01/12 – 31/05, mùa đang diễn ra hoặc mùa vừa qua.
 * Ngưỡng: mức FAO 29 năng suất còn 100% (quy ra ‰); cây không có số FAO thì dùng ngưỡng khuyến cáo của giai đoạn và
 * không ra % năng suất.
 * Mức mặn tích lũy = Σ (mặn cao nhất trong ngày − ngưỡng) × hệ số nhạy của giai đoạn hôm đó, chỉ ngày vượt ngưỡng (‰·ngày).
 * Đường FAO cho mức giảm theo độ mặn trung bình cả vụ, nên quy về mức mặn hiệu dụng = ngưỡng + tích lũy / số ngày cả mùa,
 * rồi nội suy tuyến tính giữa các điểm 100/90/75/50% (vượt 50% thì kéo dài đoạn cuối, tối đa 100%).
 * Ngày không có số đo không cộng gì: số ngày có số đo đi kèm để người xem biết kết quả dựa trên bao nhiêu ngày.
 */
public final class SalinityExposure {

    public static final String CROP_SEASON = "CROP_SEASON";
    public static final String DRY_SEASON = "DRY_SEASON";
    public static final String BASIS_FAO = "FAO";
    public static final String BASIS_STAGE = "STAGE";

    private SalinityExposure() {
    }

    /** Khoảng ngày cần đọc số đo. {@code length}: số ngày cả mùa (mẫu số khi quy về mức mặn hiệu dụng). */
    public record Season(String kind, LocalDate start, LocalDate end, int length) {
    }

    /** null khi không tính được: không phải cây trồng, chưa gieo, thiếu lịch vụ, hoặc không có ngưỡng nào */
    public static Season season(Crop crop, LocalDate plantedOn, Integer varietyDays, LocalDate today) {
        if (crop.getCategory() != Crop.Category.CROP || !hasAnyThreshold(crop)) return null;
        if (CropStages.needsSchedule(crop.getStages())) {
            if (plantedOn == null || varietyDays == null || today.isBefore(plantedOn)) return null;
            LocalDate end = plantedOn.plusDays(varietyDays - 1L);
            return new Season(CROP_SEASON, plantedOn, end, varietyDays);
        }
        // Tháng 6–11 chưa vào mùa khô mới: lấy mùa khô vừa qua
        int startYear = today.getMonthValue() == 12 ? today.getYear() : today.getYear() - 1;
        LocalDate start = LocalDate.of(startYear, 12, 1);
        LocalDate end = LocalDate.of(startYear + 1, 5, 31);
        int length = (int) ChronoUnit.DAYS.between(start, end) + 1;
        if (plantedOn != null && plantedOn.isAfter(end)) return null;
        if (plantedOn != null && plantedOn.isAfter(start)) start = plantedOn;
        return new Season(DRY_SEASON, start, end, length);
    }

    /**
     * @param dailyMax độ mặn cao nhất mỗi ngày (‰) của trạm trong mùa, theo ngày giờ Việt Nam
     * @param today    ngày cuối được tính (ngày sau đó là tương lai, bỏ qua)
     */
    public static Exposure compute(Crop crop, Season season, LocalDate plantedOn, Integer varietyDays,
                                   Map<LocalDate, Double> dailyMax, LocalDate today) {
        LocalDate through = today.isBefore(season.end()) ? today : season.end();
        Double fao100 = crop.getFaoEcw100() == null ? null : CropService.toPpt(crop.getFaoEcw100());
        List<CropStage> stages = crop.getStages();

        int withData = 0;
        int exceeded = 0;
        double dose = 0;
        Double peak = null;
        LocalDate peakOn = null;
        LocalDate lastExceeded = null;
        Double threshold = fao100;
        for (Map.Entry<LocalDate, Double> e : new TreeMap<>(dailyMax).entrySet()) {
            LocalDate day = e.getKey();
            if (day.isBefore(season.start()) || day.isAfter(through) || e.getValue() == null) continue;
            double value = e.getValue();
            CropStage stage = stageOn(stages, plantedOn, varietyDays, day);
            Double limit = fao100 != null ? fao100 : (stage == null ? null : stage.getMaxSalinity());
            withData++;
            if (peak == null || value > peak) {
                peak = value;
                peakOn = day;
            }
            if (limit == null) continue;
            threshold = limit;
            if (value > limit) {
                exceeded++;
                lastExceeded = day;
                dose += (value - limit) * (stage == null ? 1.0 : stage.getSaltSensitivity());
            }
        }
        if (threshold == null) {
            CropStage stage = stageOn(stages, plantedOn, varietyDays, through);
            threshold = stage == null ? null : stage.getMaxSalinity();
        }

        Double effective = withData == 0 || threshold == null ? null : round2(threshold + dose / season.length());
        Integer loss = effective == null || fao100 == null ? null : yieldLossPercent(crop, effective);
        int elapsed = (int) ChronoUnit.DAYS.between(season.start(), through) + 1;
        return new Exposure(season.kind(), season.start(), season.end(), through, season.length(), Math.max(0, elapsed),
                withData, exceeded, peak == null ? null : round2(peak), peakOn, lastExceeded, threshold,
                fao100 != null ? BASIS_FAO : BASIS_STAGE, round2(dose), effective, loss,
                fao100 == null ? null : crop.getFaoSource());
    }

    /** % năng suất có thể giảm ở độ mặn nước tưới {@code ppt} (‰), nội suy trên 4 điểm FAO 29 */
    static int yieldLossPercent(Crop crop, double ppt) {
        NavigableMap<Double, Double> curve = new TreeMap<>(Map.of(
                CropService.toPpt(crop.getFaoEcw100()), 0.0,
                CropService.toPpt(crop.getFaoEcw90()), 10.0,
                CropService.toPpt(crop.getFaoEcw75()), 25.0,
                CropService.toPpt(crop.getFaoEcw50()), 50.0));
        if (ppt <= curve.firstKey()) return 0;
        Map.Entry<Double, Double> lo = curve.floorEntry(ppt);
        Map.Entry<Double, Double> hi = curve.higherEntry(ppt);
        if (hi == null) {
            // Quá mức 50%: kéo dài đoạn 75% → 50%
            hi = lo;
            lo = curve.lowerEntry(hi.getKey());
        }
        double slope = (hi.getValue() - lo.getValue()) / (hi.getKey() - lo.getKey());
        double loss = lo.getValue() + slope * (ppt - lo.getKey());
        return (int) Math.round(Math.min(100, Math.max(0, loss)));
    }

    private static CropStage stageOn(List<CropStage> stages, LocalDate plantedOn, Integer varietyDays, LocalDate day) {
        CurrentStage current = CropStages.current(stages, plantedOn, varietyDays, day);
        return current == null ? null : current.stage();
    }

    private static boolean hasAnyThreshold(Crop crop) {
        return crop.getFaoEcw100() != null || crop.getStages().stream().anyMatch(s -> s.getMaxSalinity() != null);
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
