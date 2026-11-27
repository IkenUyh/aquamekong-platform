package com.aquamekong.service.crop;

import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.service.crop.CropStages.CurrentStage;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CropStagesTest {

    /** Như dữ liệu V14: mạ chưa có mốc ngày, đẻ nhánh co giãn, làm đòng–trổ 35 ngày, chín 30 ngày */
    private static final List<CropStage> RICE = List.of(
            CropStage.builder().code("chin").stageOrder(4).durationDays(30).maxSalinity(4.0).build(),
            CropStage.builder().code("ma").stageOrder(1).maxSalinity(1.0).build(),
            CropStage.builder().code("de_nhanh").stageOrder(2).flexible(true).maxSalinity(4.0).build(),
            CropStage.builder().code("lam_dong_tro").stageOrder(3).durationDays(35).maxSalinity(4.0).build());
    private static final LocalDate SOWN = LocalDate.of(2026, 11, 1);

    private static String stageOn(LocalDate today) {
        return CropStages.current(RICE, SOWN, 95, today).stage().getCode();
    }

    @Test
    void riceOf95DaysHas30DaysOfTilleringThen35ThenRipening() {
        // 95 ngày = 30 (đẻ nhánh, phần co giãn) + 35 + 30; mạ chưa có mốc nên gộp vào đẻ nhánh
        assertThat(stageOn(SOWN)).isEqualTo("de_nhanh");
        assertThat(stageOn(SOWN.plusDays(29))).isEqualTo("de_nhanh");
        assertThat(stageOn(SOWN.plusDays(30))).isEqualTo("lam_dong_tro");
        assertThat(stageOn(SOWN.plusDays(64))).isEqualTo("lam_dong_tro");
        assertThat(stageOn(SOWN.plusDays(65))).isEqualTo("chin");
        assertThat(stageOn(SOWN.plusDays(94))).isEqualTo("chin");
    }

    @Test
    void dayCountStartsAtOneOnSowingDay() {
        assertThat(CropStages.current(RICE, SOWN, 95, SOWN).day()).isEqualTo(1);
        assertThat(CropStages.current(RICE, SOWN, 95, SOWN.plusDays(40)).day()).isEqualTo(41);
    }

    @Test
    void beforeSowingAndAfterHarvest() {
        CurrentStage before = CropStages.current(RICE, SOWN, 95, SOWN.minusDays(3));
        CurrentStage after = CropStages.current(RICE, SOWN, 95, SOWN.plusDays(95));

        assertThat(before.beforePlanting()).isTrue();
        assertThat(before.stage().getCode()).isEqualTo("de_nhanh");
        assertThat(before.day()).isNull();
        assertThat(after.pastHarvest()).isTrue();
        assertThat(after.stage().getCode()).isEqualTo("chin");
    }

    @Test
    void singleStageCropIgnoresDates() {
        CropStage allYear = CropStage.builder().code("ca_nam").stageOrder(1).flexible(true).maxSalinity(0.5).build();

        CurrentStage current = CropStages.current(List.of(allYear), null, null, SOWN);

        assertThat(current.stage()).isSameAs(allYear);
        assertThat(current.pastHarvest()).isFalse();
        assertThat(CropStages.needsSchedule(List.of(allYear))).isFalse();
        assertThat(CropStages.needsSchedule(RICE)).isTrue();
        assertThat(CropStages.fixedDays(RICE)).isEqualTo(65);
    }
}
