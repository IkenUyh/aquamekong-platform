package com.aquamekong.service.crop;

import com.aquamekong.entity.crop.CropStage;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

/**
 * Giai đoạn hiện tại của cây, từ ngày gieo/trồng và số ngày của giống.
 * Giai đoạn cố định có durationDays; giai đoạn co giãn nhận phần còn lại (số ngày của giống trừ các giai đoạn cố định);
 * giai đoạn chưa có nguồn cho mốc ngày (không cố định, không co giãn, vd. mạ) dài 0 ngày, tức gộp vào giai đoạn sau.
 */
public final class CropStages {

    private CropStages() {
    }

    /**
     * @param stage         giai đoạn đang ở (trước ngày gieo: giai đoạn đầu; quá số ngày của giống: giai đoạn cuối)
     * @param day           ngày thứ mấy của vụ (ngày gieo là ngày 1), null khi không có ngày gieo
     * @param beforePlanting ngày gieo còn ở phía trước
     * @param pastHarvest   đã quá số ngày của giống (có thể đã thu hoạch)
     */
    public record CurrentStage(CropStage stage, Integer day, boolean beforePlanting, boolean pastHarvest) {
    }

    /** Tổng số ngày các giai đoạn cố định: số ngày của giống phải lớn hơn số này để còn chỗ cho giai đoạn co giãn */
    public static int fixedDays(List<CropStage> stages) {
        return stages.stream().map(CropStage::getDurationDays).filter(d -> d != null).mapToInt(Integer::intValue).sum();
    }

    /** Cây chia nhiều giai đoạn cần ngày gieo và số ngày của giống để biết đang ở giai đoạn nào */
    public static boolean needsSchedule(List<CropStage> stages) {
        return stages.size() > 1;
    }

    /** null khi cây không có giai đoạn nào */
    public static CurrentStage current(List<CropStage> stages, LocalDate plantedOn, Integer varietyDays, LocalDate today) {
        List<CropStage> ordered = stages.stream().sorted(Comparator.comparingInt(CropStage::getStageOrder)).toList();
        if (ordered.isEmpty()) return null;
        if (ordered.size() == 1) return new CurrentStage(ordered.get(0), day(plantedOn, today), false, false);
        CropStage firstLasting = ordered.stream().filter(s -> length(s, ordered, varietyDays) > 0).findFirst()
                .orElse(ordered.get(0));
        if (plantedOn == null || varietyDays == null) return new CurrentStage(firstLasting, null, false, false);

        long elapsed = ChronoUnit.DAYS.between(plantedOn, today);
        if (elapsed < 0) return new CurrentStage(firstLasting, null, true, false);
        int day = (int) elapsed + 1;
        if (elapsed >= varietyDays) return new CurrentStage(ordered.get(ordered.size() - 1), day, false, true);
        long end = 0;
        for (CropStage stage : ordered) {
            end += length(stage, ordered, varietyDays);
            if (elapsed < end) return new CurrentStage(stage, day, false, false);
        }
        return new CurrentStage(ordered.get(ordered.size() - 1), day, false, false);
    }

    private static int length(CropStage stage, List<CropStage> all, Integer varietyDays) {
        if (stage.getDurationDays() != null) return stage.getDurationDays();
        if (!stage.isFlexible() || varietyDays == null) return 0;
        return Math.max(0, varietyDays - fixedDays(all));
    }

    private static Integer day(LocalDate plantedOn, LocalDate today) {
        if (plantedOn == null || today.isBefore(plantedOn)) return null;
        return (int) ChronoUnit.DAYS.between(plantedOn, today) + 1;
    }
}
