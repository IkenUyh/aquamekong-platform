package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.Storage;
import com.aquamekong.dto.field.FieldDtos.WaterDay;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.service.field.WaterPlan.Et0;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class WaterPlanTest {

    private static final ZoneOffset VN = ZoneOffset.ofHours(7);
    private static final LocalDate TODAY = LocalDate.of(2026, 3, 10);
    private static final Instant NOW = OffsetDateTime.of(2026, 3, 10, 8, 0, 0, 0, VN).toInstant();
    private static final Map<Integer, Et0> ET0 = Map.of(3, new Et0(5.0, "FAO"), 4, new Et0(5.0, "FAO"));

    /** Như V14 + V19: 95 ngày = 30 đẻ nhánh + 35 làm đòng + 30 chín; ngưỡng làm đòng đặt 2‰ để thấy đổi ngưỡng */
    private static Crop rice() {
        Crop crop = Crop.builder().code("lua").name("Lúa").category(Crop.Category.CROP).build();
        crop.setStages(List.of(
                CropStage.builder().code("ma").stageOrder(1).maxSalinity(1.0).kc(1.05).kcSource("FAO 56").build(),
                CropStage.builder().code("de_nhanh").stageOrder(2).flexible(true).maxSalinity(4.0).kc(1.05).kcSource("FAO 56").build(),
                CropStage.builder().code("lam_dong_tro").stageOrder(3).durationDays(35).maxSalinity(2.0).kc(1.20).kcSource("FAO 56").build(),
                CropStage.builder().code("chin").stageOrder(4).durationDays(30).maxSalinity(4.0).kc(0.90).kcSource("FAO 56").build()));
        return crop;
    }

    private static Crop single(String code, Crop.Category category, Double max, Double min, Double kc) {
        Crop crop = Crop.builder().code(code).name(code).category(category).build();
        crop.setStages(List.of(CropStage.builder().code("ca_nam").stageOrder(1).flexible(true)
                .maxSalinity(max).minSalinity(min).kc(kc).kcSource(kc == null ? null : "FAO 56").build()));
        return crop;
    }

    private static Measurement reading(double value, LocalDate day) {
        return Measurement.builder().value(value).recordedAt(day.atStartOfDay().atOffset(VN)).build();
    }

    private static SalinityForecast forecast(int offset, double value, Double risk) {
        return SalinityForecast.builder().forecastDate(TODAY.plusDays(offset)).predictedSalinity(value).riskSalinity(risk).build();
    }

    /** Dự báo cùng một mức cho cả 8 ngày */
    private static List<SalinityForecast> flat(double value) {
        return new ArrayList<>(IntStream.rangeClosed(0, 7).mapToObj(i -> forecast(i, value, null)).toList());
    }

    private static List<WaterDay> days(Crop crop, Measurement latest, List<SalinityForecast> forecasts,
                                       LocalDate plantedOn, Integer varietyDays) {
        return WaterPlan.days(new StationSnapshot(latest, forecasts), crop, plantedOn, varietyDays, NOW);
    }

    @Test
    void coversTodayAndTheNextSevenDays() {
        List<WaterDay> d = days(single("dua", Crop.Category.CROP, 2.0, null, 1.0), reading(0.5, TODAY), flat(0.5), null, null);
        assertThat(d).hasSize(8);
        assertThat(d.get(0).date()).isEqualTo(TODAY);
        assertThat(d.get(7).date()).isEqualTo(TODAY.plusDays(7));
        assertThat(d).allMatch(x -> WaterPlan.SAFE.equals(x.status()) && x.freshFraction() == 0.0);
    }

    @Test
    void todayUsesTheFreshMeasurementWhenItIsHigherThanTheForecast() {
        Crop coconut = single("dua", Crop.Category.CROP, 2.0, null, 1.0);
        List<WaterDay> d = days(coconut, reading(3.0, TODAY.minusDays(1)), flat(1.0), null, null);
        assertThat(d.get(0).status()).isEqualTo(WaterPlan.EXCEED);
        assertThat(d.get(0).measured()).isTrue();
        assertThat(d.get(0).salinity()).isEqualTo(3.0);
        assertThat(d.get(1).measured()).isFalse();
        assertThat(d.get(1).status()).isEqualTo(WaterPlan.SAFE);

        // Dự báo hôm nay cao hơn số đo: lấy dự báo
        List<WaterDay> higher = days(coconut, reading(1.0, TODAY), flat(2.5), null, null);
        assertThat(higher.get(0).measured()).isFalse();
        assertThat(higher.get(0).salinity()).isEqualTo(2.5);
    }

    @Test
    void staleStationDropsItsForecasts() {
        List<WaterDay> d = days(single("dua", Crop.Category.CROP, 2.0, null, 1.0), reading(9.0, TODAY.minusDays(4)),
                flat(5.0), null, null);
        assertThat(d).allMatch(x -> WaterPlan.UNKNOWN.equals(x.status()) && x.salinity() == null
                && x.freshFraction() == null);
    }

    @Test
    void dayWithoutForecastIsUnknown() {
        List<SalinityForecast> f = flat(1.0);
        f.remove(3);
        List<WaterDay> d = days(single("dua", Crop.Category.CROP, 2.0, null, 1.0), reading(1.0, TODAY), f, null, null);
        assertThat(d.get(3).status()).isEqualTo(WaterPlan.UNKNOWN);
        assertThat(d.get(4).status()).isEqualTo(WaterPlan.SAFE);
    }

    @Test
    void riskLevelAboveTheThresholdMarksTheDayAndDrivesTheMix() {
        List<SalinityForecast> f = flat(1.0);
        f.set(2, forecast(2, 1.5, 3.0));
        List<WaterDay> d = days(single("dua", Crop.Category.CROP, 2.0, null, 1.0), reading(1.0, TODAY), f, null, null);
        assertThat(d.get(2).status()).isEqualTo(WaterPlan.RISK);
        // S = 3 (mức có thể lên tới), T = 2, P = 0 → 1/3 nước ao
        assertThat(d.get(2).freshFraction()).isCloseTo(1.0 / 3, within(1e-9));
    }

    @Test
    void thresholdFollowsTheStageOfEachDay() {
        // Giống 95 ngày: đẻ nhánh 95 − 35 − 30 = 30 ngày, làm đòng từ ngày 31. Hôm nay là ngày 28, nên ngày 31 là hôm nay + 3
        LocalDate sown = TODAY.minusDays(27);
        List<WaterDay> d = days(rice(), reading(3.0, TODAY), flat(3.0), sown, 95);
        assertThat(d.get(2).threshold()).isEqualTo(4.0);
        assertThat(d.get(2).status()).isEqualTo(WaterPlan.SAFE);
        assertThat(d.get(3).threshold()).isEqualTo(2.0);
        assertThat(d.get(3).status()).isEqualTo(WaterPlan.EXCEED);
    }

    @Test
    void aquacultureIsComparedAgainstItsRangeWithoutAMix() {
        Crop shrimp = single("tom_su", Crop.Category.AQUACULTURE, 35.0, 5.0, null);
        List<SalinityForecast> f = flat(10.0);
        f.set(1, forecast(1, 3.0, null));
        f.set(2, forecast(2, 36.0, null));
        List<WaterDay> d = days(shrimp, reading(10.0, TODAY), f, null, null);
        assertThat(d.get(0).status()).isEqualTo(WaterPlan.SAFE);
        assertThat(d.get(1).status()).isEqualTo(WaterPlan.EXCEED);
        assertThat(d.get(2).status()).isEqualTo(WaterPlan.EXCEED);
        assertThat(d.get(1).minThreshold()).isEqualTo(5.0);
        assertThat(d).allMatch(x -> x.freshFraction() == null);
        assertThat(WaterPlan.storage(d, shrimp, null, null, 1.0, 500.0, ET0)).isNull();
    }

    @Test
    void mixFraction() {
        assertThat(WaterPlan.mixFraction(1.5, 2.0, 0)).isZero();
        assertThat(WaterPlan.mixFraction(2.0, 2.0, 0)).isZero();
        // 6‰ sông, ngưỡng 2: 2/3 nước ao, 1/3 nước sông
        assertThat(WaterPlan.mixFraction(6.0, 2.0, 0)).isCloseTo(2.0 / 3, within(1e-9));
        // Ao mặn 1‰: (6 − 2) / (6 − 1) = 0,8
        assertThat(WaterPlan.mixFraction(6.0, 2.0, 1.0)).isCloseTo(0.8, within(1e-9));
        // Ao không dưới ngưỡng: chỉ tưới nước ao (pha không làm nhạt được)
        assertThat(WaterPlan.mixFraction(6.0, 2.0, 2.0)).isEqualTo(1.0);
        assertThat(WaterPlan.mixFraction(6.0, 2.0, 3.0)).isEqualTo(1.0);
    }

    @Test
    void dailyNeedIsAreaTimesKcTimesEt0() {
        // 1,5 ha × 10 × 1,2 × 5 mm = 90 m³
        assertThat(WaterPlan.dailyNeedM3(1.5, 1.2, 5.0)).isCloseTo(90.0, within(1e-9));
    }

    @Test
    void pondRunsDryMidWayUnlessMixed() {
        // Dừa 1 ha, Kc 1, ET₀ 5 → 50 m³/ngày. Hôm nay + 1 an toàn, 5 ngày mặn 6‰ (ngưỡng 2: pha 2/3 nước ao), rồi an toàn
        Crop coconut = single("dua", Crop.Category.CROP, 2.0, null, 1.0);
        List<SalinityForecast> f = flat(1.0);
        for (int i = 2; i <= 6; i++) f.set(i, forecast(i, 6.0, null));
        List<WaterDay> d = days(coconut, reading(1.0, TODAY), f, null, null);

        Storage s = WaterPlan.storage(d, coconut, null, null, 1.0, 160.0, ET0);
        assertThat(s.unsafeDays()).isEqualTo(5);
        assertThat(s.dailyNeedM3()).isEqualTo(50.0);
        assertThat(s.kc()).isEqualTo(1.0);
        assertThat(s.et0()).isEqualTo(5.0);
        // 160 m³: toàn nước ao đủ 3 ngày (150); pha 2/3 × 50 ≈ 33,3 m³/ngày → đủ 4 ngày (133), ngày 5 thiếu
        assertThat(s.pondDays()).isEqualTo(3);
        assertThat(s.pondDaysWithMix()).isEqualTo(4);
        assertThat(s.fillBy()).isEqualTo(TODAY.plusDays(1));
        // 5 × 33,33 = 166,7 − 160 → cần thêm 7 m³
        assertThat(s.extraNeededM3()).isEqualTo(7);

        Storage big = WaterPlan.storage(d, coconut, null, null, 1.0, 400.0, ET0);
        assertThat(big.pondDays()).isEqualTo(5);
        assertThat(big.pondDaysWithMix()).isEqualTo(5);
        assertThat(big.extraNeededM3()).isZero();
    }

    @Test
    void fieldWithoutPondNeedsTheWholeMixedVolume() {
        Crop coconut = single("dua", Crop.Category.CROP, 2.0, null, 1.0);
        List<WaterDay> d = days(coconut, reading(6.0, TODAY), flat(6.0), null, null);
        Storage s = WaterPlan.storage(d, coconut, null, null, 1.0, null, ET0);
        assertThat(s.pondVolumeM3()).isNull();
        assertThat(s.pondDays()).isZero();
        // Hôm nay đã mặn: không còn ngày lấy nước sông vào ao
        assertThat(s.fillBy()).isNull();
        assertThat(s.extraNeededM3()).isEqualTo(267); // 8 × 33,33 = 266,7
    }

    @Test
    void noStorageWithoutKcAreaOrForNonCrops() {
        Crop durian = single("sau_rieng", Crop.Category.CROP, 0.5, null, null);
        List<WaterDay> d = days(durian, reading(1.0, TODAY), flat(1.0), null, null);
        assertThat(d.get(0).status()).isEqualTo(WaterPlan.EXCEED);
        assertThat(d.get(0).freshFraction()).isEqualTo(0.5);
        assertThat(WaterPlan.storage(d, durian, null, null, 1.0, 500.0, ET0)).isNull();

        Crop coconut = single("dua", Crop.Category.CROP, 2.0, null, 1.0);
        assertThat(WaterPlan.storage(d, coconut, null, null, null, 500.0, ET0)).isNull();
        assertThat(WaterPlan.storage(d, coconut, null, null, 1.0, 500.0, Map.of())).isNull();

        Crop domestic = single("nuoc_sinh_hoat", Crop.Category.DOMESTIC_WATER, 0.45, null, null);
        List<WaterDay> dd = days(domestic, reading(0.9, TODAY), flat(0.9), null, null);
        assertThat(dd.get(0).freshFraction()).isEqualTo(0.5);
        assertThat(WaterPlan.storage(dd, domestic, null, null, 1.0, 500.0, ET0)).isNull();
    }

    @Test
    void storageWithNoSaltyDaysReportsTodaysNeed() {
        Crop coconut = single("dua", Crop.Category.CROP, 2.0, null, 1.0);
        List<WaterDay> d = days(coconut, reading(1.0, TODAY), flat(1.0), null, null);
        Storage s = WaterPlan.storage(d, coconut, null, null, 2.0, 100.0, ET0);
        assertThat(s.unsafeDays()).isZero();
        assertThat(s.dailyNeedM3()).isEqualTo(100.0);
        assertThat(s.fillBy()).isNull();
        assertThat(s.extraNeededM3()).isZero();
    }
}
