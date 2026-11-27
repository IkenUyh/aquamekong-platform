package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.Exposure;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.service.field.SalinityExposure.Season;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SalinityExposureTest {

    private static final LocalDate SOWN = LocalDate.of(2026, 11, 1);

    /** Như V14 + V17: FAO lúa 2,0/2,6/3,4/4,8 dS/m (1,28/1,66/2,18/3,07‰); 95 ngày = 30 đẻ nhánh + 35 làm đòng + 30 chín */
    private static Crop rice() {
        Crop crop = Crop.builder().code("lua").name("Lúa").category(Crop.Category.CROP)
                .faoEcw100(2.0).faoEcw90(2.6).faoEcw75(3.4).faoEcw50(4.8).faoSource("FAO 29").build();
        crop.setStages(List.of(
                CropStage.builder().code("ma").stageOrder(1).maxSalinity(1.0).saltSensitivity(1.5).build(),
                CropStage.builder().code("de_nhanh").stageOrder(2).flexible(true).maxSalinity(4.0).saltSensitivity(1.0).build(),
                CropStage.builder().code("lam_dong_tro").stageOrder(3).durationDays(35).maxSalinity(4.0).saltSensitivity(1.5).build(),
                CropStage.builder().code("chin").stageOrder(4).durationDays(30).maxSalinity(4.0).saltSensitivity(0.5).build()));
        return crop;
    }

    private static Crop durian() {
        Crop crop = Crop.builder().code("sau_rieng").name("Sầu riêng").category(Crop.Category.CROP).build();
        crop.setStages(List.of(CropStage.builder().code("ca_nam").stageOrder(1).flexible(true).maxSalinity(0.5).build()));
        return crop;
    }

    private static Exposure riceExposure(Map<LocalDate, Double> daily, LocalDate today) {
        Season season = SalinityExposure.season(rice(), SOWN, 95, today);
        return SalinityExposure.compute(rice(), season, SOWN, 95, daily, today);
    }

    @Test
    void riceSeasonRunsFromSowingForTheVarietyLength() {
        Season season = SalinityExposure.season(rice(), SOWN, 95, SOWN.plusDays(10));
        assertThat(season.kind()).isEqualTo(SalinityExposure.CROP_SEASON);
        assertThat(season.start()).isEqualTo(SOWN);
        assertThat(season.end()).isEqualTo(SOWN.plusDays(94));
        assertThat(season.length()).isEqualTo(95);
        assertThat(SalinityExposure.season(rice(), SOWN, 95, SOWN.minusDays(1))).isNull();
    }

    @Test
    void countsDaysAboveTheFaoThresholdWithPeakAndLastDay() {
        Map<LocalDate, Double> daily = new HashMap<>();
        daily.put(SOWN, 0.8);
        daily.put(SOWN.plusDays(1), 2.28);
        daily.put(SOWN.plusDays(2), 3.0);
        daily.put(SOWN.plusDays(3), 1.0);
        daily.put(SOWN.minusDays(5), 9.0); // trước ngày gieo: không tính

        Exposure e = riceExposure(daily, SOWN.plusDays(3));
        assertThat(e.threshold()).isEqualTo(1.28);
        assertThat(e.thresholdBasis()).isEqualTo(SalinityExposure.BASIS_FAO);
        assertThat(e.daysWithData()).isEqualTo(4);
        assertThat(e.daysExceeded()).isEqualTo(2);
        assertThat(e.maxSalinity()).isEqualTo(3.0);
        assertThat(e.maxOn()).isEqualTo(SOWN.plusDays(2));
        assertThat(e.lastExceededOn()).isEqualTo(SOWN.plusDays(2));
        // (2,28 − 1,28) + (3,0 − 1,28), đẻ nhánh hệ số 1
        assertThat(e.cumulative()).isEqualTo(2.72);
        assertThat(e.daysElapsed()).isEqualTo(4);
    }

    @Test
    void stageSensitivityWeightsTheExcess() {
        // Ngày 31 là làm đòng (×1,5), ngày 66 là chín (×0,5)
        Map<LocalDate, Double> daily = Map.of(SOWN.plusDays(30), 2.28, SOWN.plusDays(65), 2.28);
        Exposure e = riceExposure(daily, SOWN.plusDays(94));
        assertThat(e.cumulative()).isEqualTo(2.0);
    }

    @Test
    void steadySalinityAllSeasonGivesTheFaoLoss() {
        // Mặn đều 2,18‰ (mức FAO còn 75%) suốt vụ: hệ số trung bình ≈ 1,03 nên giảm khoảng 25%
        Map<LocalDate, Double> daily = new HashMap<>();
        for (int i = 0; i < 95; i++) daily.put(SOWN.plusDays(i), 2.18);
        Exposure e = riceExposure(daily, SOWN.plusDays(120));
        assertThat(e.computedThrough()).isEqualTo(SOWN.plusDays(94));
        assertThat(e.daysExceeded()).isEqualTo(95);
        assertThat(e.yieldLossPercent()).isBetween(25, 27);
    }

    @Test
    void aFewSaltyDaysCostLittle() {
        Exposure e = riceExposure(Map.of(SOWN.plusDays(5), 3.0, SOWN.plusDays(6), 3.0), SOWN.plusDays(10));
        // 1,28 + 3,44 / 95 ≈ 1,32‰ → dưới 1%
        assertThat(e.effectiveSalinity()).isEqualTo(1.32);
        assertThat(e.yieldLossPercent()).isEqualTo(1);
    }

    @Test
    void interpolatesBetweenFaoPointsAndExtrapolatesPastHalf() {
        Crop rice = rice();
        assertThat(SalinityExposure.yieldLossPercent(rice, 1.0)).isZero();
        assertThat(SalinityExposure.yieldLossPercent(rice, 1.66)).isEqualTo(10);
        // giữa 90% và 75%: 10 + (2,0 − 1,66) / (2,18 − 1,66) × 15 ≈ 19,8
        assertThat(SalinityExposure.yieldLossPercent(rice, 2.0)).isEqualTo(20);
        assertThat(SalinityExposure.yieldLossPercent(rice, 3.07)).isEqualTo(50);
        assertThat(SalinityExposure.yieldLossPercent(rice, 3.96)).isEqualTo(75);
        assertThat(SalinityExposure.yieldLossPercent(rice, 20)).isEqualTo(100);
    }

    @Test
    void noReadingsMeansNoEstimate() {
        Exposure e = riceExposure(Map.of(), SOWN.plusDays(10));
        assertThat(e.daysWithData()).isZero();
        assertThat(e.effectiveSalinity()).isNull();
        assertThat(e.yieldLossPercent()).isNull();
    }

    @Test
    void cropWithoutFaoUsesStageThresholdAndDrySeasonButNoYieldPercent() {
        LocalDate today = LocalDate.of(2027, 3, 10);
        Season season = SalinityExposure.season(durian(), null, null, today);
        assertThat(season.kind()).isEqualTo(SalinityExposure.DRY_SEASON);
        assertThat(season.start()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(season.end()).isEqualTo(LocalDate.of(2027, 5, 31));

        Exposure e = SalinityExposure.compute(durian(), season, null, null,
                Map.of(LocalDate.of(2027, 2, 1), 1.5, LocalDate.of(2027, 2, 2), 0.3), today);
        assertThat(e.thresholdBasis()).isEqualTo(SalinityExposure.BASIS_STAGE);
        assertThat(e.threshold()).isEqualTo(0.5);
        assertThat(e.daysExceeded()).isEqualTo(1);
        assertThat(e.cumulative()).isEqualTo(1.0);
        assertThat(e.yieldLossPercent()).isNull();
    }

    @Test
    void betweenDrySeasonsShowsTheLastOne() {
        Season season = SalinityExposure.season(durian(), null, null, LocalDate.of(2026, 11, 26));
        assertThat(season.start()).isEqualTo(LocalDate.of(2025, 12, 1));
        assertThat(season.end()).isEqualTo(LocalDate.of(2026, 5, 31));
    }

    @Test
    void waterUsesOtherThanCropsAreNotEstimated() {
        Crop shrimp = Crop.builder().code("tom_su").category(Crop.Category.AQUACULTURE).build();
        shrimp.setStages(List.of(CropStage.builder().code("ca_vu").stageOrder(1).maxSalinity(35.0).minSalinity(5.0).build()));
        assertThat(SalinityExposure.season(shrimp, null, null, LocalDate.of(2027, 3, 1))).isNull();
        Crop basa = Crop.builder().code("x").category(Crop.Category.CROP).build();
        basa.setStages(List.of(CropStage.builder().code("ca_nam").stageOrder(1).build()));
        assertThat(SalinityExposure.season(basa, null, null, LocalDate.of(2027, 3, 1))).isNull();
    }
}
