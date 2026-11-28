package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.field.FieldDtos.Storage;
import com.aquamekong.dto.field.FieldDtos.WaterDay;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.field.FieldProfile;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ActionPlanTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 14);

    private static Crop crop(Crop.Category category) {
        Crop crop = Crop.builder().code("dua").name("Dừa").category(category).build();
        crop.setStages(List.of(CropStage.builder().code("ca_nam").name("Cả năm").stageOrder(1).flexible(true)
                .maxSalinity(4.0).build()));
        return crop;
    }

    private static FieldProfile field(Crop.Category category, boolean pond) {
        return FieldProfile.builder().id(7L).name("Vườn").crop(crop(category)).hasPond(pond)
                .pondVolumeM3(pond ? 300.0 : null).build();
    }

    /** Một ngày: trạng thái, độ mặn, mức rủi ro, phần nước ao */
    private static WaterDay day(int offset, String status, Double salinity, Double risk, Double fraction) {
        return new WaterDay(TODAY.plusDays(offset), status, salinity, risk, false, 4.0, null, fraction);
    }

    private static WaterDay safe(int offset) {
        return day(offset, WaterPlan.SAFE, 1.0, null, 0.0);
    }

    /** Mặn S‰ với ngưỡng 4‰: phần nước ao (S − 4) / S */
    private static WaterDay exceed(int offset, double s) {
        return day(offset, WaterPlan.EXCEED, s, null, (s - 4) / s);
    }

    private static FieldDtos.WaterPlan plan(List<WaterDay> days, Storage storage) {
        return new FieldDtos.WaterPlan(days, storage, 0);
    }

    private static Storage storage(int unsafeDays, Double pond, int pondDays, int mixDays, long extra) {
        return new Storage(50, 1.0, 5.0, "FAO", "FAO", "ước lượng", unsafeDays, pond, pondDays, mixDays, null, extra);
    }

    private static List<String> messages(List<PlanAction> actions) {
        return actions.stream().map(PlanAction::message).toList();
    }

    /** Hai ngày an toàn, rồi 3 ngày 12‰ (pha 2/3), 2 ngày 20‰ (pha 4/5 → chỉ nước ao), một ngày an toàn */
    private static List<WaterDay> saltyWeek() {
        return List.of(safe(0), safe(1), exceed(2, 12), exceed(3, 12), exceed(4, 12), exceed(5, 20), exceed(6, 20), safe(7));
    }

    @Test
    void storesBeforeTheFirstSaltyDayAndMixesByRoundedFraction() {
        List<PlanAction> actions = ActionPlan.waterActions(field(Crop.Category.CROP, true),
                plan(saltyWeek(), storage(5, 300.0, 5, 5, 0)), TODAY);

        assertThat(messages(actions)).containsExactly(
                "Trữ đầy ao trước hết ngày 15/11",
                "Từ 16/11 tới 18/11 tưới pha 2/3 nước ao, 1/3 nước sông",
                "Từ 19/11 tới 20/11 chỉ tưới nước ao, không pha nước sông",
                "Lấy nước được: 14/11–15/11, 21/11");
        PlanAction store = actions.get(0);
        assertThat(store.kind()).isEqualTo(ActionPlan.STORE);
        assertThat(store.from()).isEqualTo(TODAY.plusDays(1));
        assertThat(store.priority()).isEqualTo(ActionPlan.HIGH);
        assertThat(actions.get(1).kind()).isEqualTo(ActionPlan.MIX);
        assertThat(actions.get(1).fraction()).isEqualTo(2.0 / 3);
        assertThat(actions.get(1).until()).isEqualTo(TODAY.plusDays(4));
        assertThat(actions.get(2).kind()).isEqualTo(ActionPlan.POND_ONLY);
        assertThat(actions.get(3).kind()).isEqualTo(ActionPlan.TAKE_WATER);
        assertThat(actions).allMatch(a -> ActionPlan.WATER.equals(a.source()));
    }

    @Test
    void fractionsRoundUpLikeTheFrontend() {
        assertThat(ActionPlan.roundUp(0.0)).isNull();
        assertThat(ActionPlan.roundUp(null)).isNull();
        assertThat(ActionPlan.roundUp(0.2).label()).isEqualTo("1/4");
        assertThat(ActionPlan.roundUp(0.26).label()).isEqualTo("1/3");
        assertThat(ActionPlan.roundUp(2.0 / 3).label()).isEqualTo("2/3");
        assertThat(ActionPlan.roundUp(0.67).label()).isEqualTo("3/4");
        assertThat(ActionPlan.roundUp(0.8).pondOnly()).isTrue();
        assertThat(ActionPlan.roundUp(1.0).pondOnly()).isTrue();
    }

    @Test
    void storeSaysHowMuchIsMissing() {
        List<PlanAction> actions = ActionPlan.waterActions(field(Crop.Category.CROP, true),
                plan(saltyWeek(), storage(5, 300.0, 3, 4, 1250)), TODAY);
        assertThat(actions.get(0).message()).isEqualTo("Trữ đầy ao trước hết ngày 15/11, cần thêm khoảng 1.250 m³");
    }

    @Test
    void withoutAPondStoreElsewhereAndStopTakingRiverWater() {
        List<PlanAction> actions = ActionPlan.waterActions(field(Crop.Category.CROP, false),
                plan(saltyWeek(), storage(5, null, 0, 0, 180)), TODAY);

        assertThat(messages(actions)).containsExactly(
                "Trữ nước ngọt (bồn, kênh nội đồng) trước hết ngày 15/11, khoảng 180 m³ để pha tưới",
                "Từ 16/11 tới 20/11 không lấy nước sông tưới: mặn tới 20‰, ngưỡng 4‰",
                "Lấy nước được: 14/11–15/11, 21/11");
        assertThat(actions).noneMatch(a -> ActionPlan.MIX.equals(a.kind()) || ActionPlan.POND_EMPTY.equals(a.kind()));
        assertThat(actions.get(1).kind()).isEqualTo(ActionPlan.STOP_INTAKE);
    }

    @Test
    void pondRunningOutGivesTheDay() {
        List<PlanAction> actions = ActionPlan.waterActions(field(Crop.Category.CROP, true),
                plan(saltyWeek(), storage(5, 300.0, 2, 3, 400)), TODAY);

        PlanAction empty = actions.stream().filter(a -> ActionPlan.POND_EMPTY.equals(a.kind())).findFirst().orElseThrow();
        // Đủ 3 ngày mặn khi pha: cạn vào ngày mặn thứ tư (19/11)
        assertThat(empty.from()).isEqualTo(TODAY.plusDays(5));
        assertThat(empty.message()).isEqualTo("Ao có thể cạn khoảng ngày 19/11 (pha đúng tỷ lệ thì đủ 3 trong 5 ngày mặn)");
        assertThat(empty.priority()).isEqualTo(ActionPlan.HIGH);
    }

    @Test
    void riskDaysAskToMeasureAtTheSluice() {
        List<WaterDay> days = List.of(safe(0), day(1, WaterPlan.RISK, 3.0, 5.0, 0.2), day(2, WaterPlan.RISK, 3.0, 4.4, 0.1),
                safe(3), safe(4), safe(5), safe(6), safe(7));
        List<PlanAction> actions = ActionPlan.waterActions(field(Crop.Category.CROP, true), plan(days, null), TODAY);

        assertThat(messages(actions)).contains(
                "Trữ đầy ao trước hết ngày 14/11",
                "Từ 15/11 tới 16/11 tưới pha 1/4 nước ao, 3/4 nước sông",
                "Từ 15/11 tới 16/11 nước sông có thể vượt ngưỡng (có thể lên tới 5‰), nên đo mặn tại cống trước khi lấy");
    }

    @Test
    void aquacultureOutOfRangeStopsIntakeIntoThePond() {
        Crop shrimp = crop(Crop.Category.AQUACULTURE);
        FieldProfile f = FieldProfile.builder().id(8L).name("Ao tôm").crop(shrimp).hasPond(true).build();
        List<WaterDay> days = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            boolean low = i >= 3 && i <= 4;
            days.add(new WaterDay(TODAY.plusDays(i), low ? WaterPlan.EXCEED : WaterPlan.SAFE, low ? 3.0 : 12.0, null,
                    false, 35.0, 5.0, null));
        }
        List<PlanAction> actions = ActionPlan.waterActions(f, plan(days, null), TODAY);

        assertThat(messages(actions)).containsExactly(
                "Lấy đủ nước vào ao nuôi trước hết ngày 16/11",
                "Từ 17/11 tới 18/11 không lấy nước sông vào ao nuôi: độ mặn ngoài khoảng 5–35‰",
                "Lấy nước vào ao nuôi được: 14/11–16/11, 19/11–21/11");
        FieldPlan built = ActionPlan.plan(f, plan(days, null), actions);
        assertThat(built.verdict()).isEqualTo(ActionPlan.YELLOW);
        assertThat(built.headline()).isEqualTo("Có, tới hết ngày 16/11; từ 17/11 độ mặn ở trạm ra ngoài khoảng nuôi.");
    }

    @Test
    void staleStationOnlyAsksToMeasure() {
        List<WaterDay> days = new ArrayList<>();
        for (int i = 0; i < 8; i++) days.add(day(i, WaterPlan.UNKNOWN, null, null, null));
        FieldDtos.WaterPlan water = plan(days, null);
        FieldProfile f = field(Crop.Category.CROP, true);

        List<PlanAction> actions = ActionPlan.waterActions(f, water, TODAY);
        assertThat(actions).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(ActionPlan.CHECK);
            assertThat(a.from()).isEqualTo(TODAY);
        });
        FieldPlan built = ActionPlan.plan(f, water, actions);
        assertThat(built.verdict()).isEqualTo(ActionPlan.GREY);
        assertThat(built.headline()).startsWith("Chưa biết");
    }

    @Test
    void stageChangeToAStricterThresholdIsAnnounced() {
        Crop rice = Crop.builder().code("lua").name("Lúa").category(Crop.Category.CROP).build();
        rice.setStages(List.of(
                CropStage.builder().code("de_nhanh").name("Đẻ nhánh").stageOrder(1).flexible(true).maxSalinity(4.0).build(),
                CropStage.builder().code("lam_dong_tro").name("Làm đòng – trổ").stageOrder(2).durationDays(35).maxSalinity(2.0).build(),
                CropStage.builder().code("chin").name("Chín").stageOrder(3).durationDays(30).maxSalinity(4.0).build()));
        // Giống 95 ngày: đẻ nhánh 30 ngày, gieo 27 ngày trước → làm đòng từ ngày thứ 31 = hôm nay + 3
        FieldProfile f = FieldProfile.builder().id(9L).name("Ruộng A").crop(rice).varietyDays(95)
                .plantedOn(TODAY.minusDays(27)).hasPond(true).build();
        List<WaterDay> days = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            days.add(new WaterDay(TODAY.plusDays(i), WaterPlan.SAFE, 1.0, null, false, i < 3 ? 4.0 : 2.0, null, 0.0));
        }
        List<PlanAction> actions = ActionPlan.waterActions(f, plan(days, null), TODAY);

        assertThat(actions).filteredOn(a -> ActionPlan.STAGE_CHANGE.equals(a.kind())).singleElement()
                .satisfies(a -> {
                    assertThat(a.from()).isEqualTo(TODAY.plusDays(3));
                    assertThat(a.message()).isEqualTo("Từ 17/11 lúa vào giai đoạn làm đòng – trổ, ngưỡng còn 2‰");
                });
    }

    @Test
    void verdictAndHeadline() {
        FieldProfile f = field(Crop.Category.CROP, true);
        List<WaterDay> allSafe = new ArrayList<>();
        for (int i = 0; i < 8; i++) allSafe.add(safe(i));
        FieldPlan green = ActionPlan.plan(f, plan(allSafe, null), List.of());
        assertThat(green.verdict()).isEqualTo(ActionPlan.GREEN);
        assertThat(green.headline()).isEqualTo("Có, cả tuần nước sông trong ngưỡng.");

        FieldPlan yellow = ActionPlan.plan(f, plan(saltyWeek(), null), List.of());
        assertThat(yellow.verdict()).isEqualTo(ActionPlan.YELLOW);
        assertThat(yellow.headline()).isEqualTo("Có, tới hết ngày 15/11; từ 16/11 nước sông mặn.");

        List<WaterDay> redNow = List.of(exceed(0, 6), exceed(1, 6), safe(2), safe(3), safe(4), safe(5), safe(6), safe(7));
        FieldPlan red = ActionPlan.plan(f, plan(redNow, null), List.of());
        assertThat(red.verdict()).isEqualTo(ActionPlan.RED);
        assertThat(red.headline()).isEqualTo("Không, hôm nay nước sông mặn hơn ngưỡng; có thể lấy lại từ 16/11.");

        List<WaterDay> riskToday = new ArrayList<>(allSafe);
        riskToday.set(0, day(0, WaterPlan.RISK, 3.0, 4.5, 0.2));
        assertThat(ActionPlan.verdict(plan(riskToday, null))).isEqualTo(ActionPlan.YELLOW);
    }

    @Test
    void planSortsByDateWithTakeWaterLast() {
        FieldProfile f = field(Crop.Category.CROP, true);
        FieldDtos.WaterPlan water = plan(saltyWeek(), storage(5, 300.0, 2, 3, 400));
        List<PlanAction> mixed = new ArrayList<>(ActionPlan.waterActions(f, water, TODAY));
        mixed.add(0, new PlanAction("FERTILIZE", "MEDIUM", TODAY.plusDays(3), TODAY.plusDays(3), null, "Bón thúc", "FERTILIZER"));
        java.util.Collections.reverse(mixed);

        List<PlanAction> sorted = ActionPlan.plan(f, water, mixed).actions();
        assertThat(sorted).extracting(PlanAction::kind).containsExactly(
                ActionPlan.STORE, ActionPlan.MIX, "FERTILIZE", ActionPlan.POND_ONLY, ActionPlan.POND_EMPTY, ActionPlan.TAKE_WATER);
    }

    // ---- Dấu vân tay ----

    @Test
    void digestKeepsOnlyImportantWaterActionsWithoutSalinity() {
        FieldProfile f = field(Crop.Category.CROP, true);
        List<PlanAction> actions = new ArrayList<>(ActionPlan.waterActions(f, plan(saltyWeek(), storage(5, 300.0, 5, 5, 0)), TODAY));
        actions.add(new PlanAction("FERTILIZE", "MEDIUM", TODAY, TODAY, null, "Bón thúc", "FERTILIZER"));

        assertThat(ActionPlan.digest(actions)).isEqualTo(
                "MIX:2026-11-16:2026-11-18:2/3|POND_ONLY:2026-11-19:2026-11-20:1|STORE:2026-11-15:2026-11-15:");
    }

    @Test
    void slidingWindowWithNothingNewIsNoChange() {
        FieldProfile f = field(Crop.Category.CROP, true);
        // Hôm qua: mặn từ 16/11 kéo tới hết cửa sổ (21/11)
        LocalDate yesterday = TODAY;
        List<WaterDay> before = new ArrayList<>(List.of(safe(0), safe(1)));
        for (int i = 2; i < 8; i++) before.add(exceed(i, 12));
        String old = ActionPlan.digest(ActionPlan.waterActions(f, plan(before, null), yesterday));

        // Hôm nay (15/11): cửa sổ trượt một ngày, vẫn mặn từ 16/11, thêm 22/11 cũng mặn
        LocalDate today = TODAY.plusDays(1);
        List<WaterDay> after = new ArrayList<>(List.of(safe(1)));
        for (int i = 2; i < 9; i++) after.add(exceed(i, 12));
        String now = ActionPlan.digest(ActionPlan.waterActions(f, plan(after, null), today));

        assertThat(now).isNotEqualTo(old);
        assertThat(ActionPlan.changes(old, now, today)).isEmpty();

        // Hai ngày sau: mặn đã bắt đầu (hôm nay 16/11), trữ đã qua: vẫn không đổi
        LocalDate later = TODAY.plusDays(2);
        List<WaterDay> ongoing = new ArrayList<>();
        for (int i = 2; i < 10; i++) ongoing.add(exceed(i, 12));
        String third = ActionPlan.digest(ActionPlan.waterActions(f, plan(ongoing, null), later));
        assertThat(ActionPlan.changes(now, third, later)).isEmpty();
    }

    @Test
    void earlierSaltOrNewMixIsAChange() {
        FieldProfile f = field(Crop.Category.CROP, true);
        String old = ActionPlan.digest(ActionPlan.waterActions(f, plan(saltyWeek(), null), TODAY));

        // Mặn tới sớm một ngày
        List<WaterDay> earlier = new ArrayList<>(saltyWeek());
        earlier.set(1, exceed(1, 12));
        String now = ActionPlan.digest(ActionPlan.waterActions(f, plan(earlier, null), TODAY));

        Set<String> changes = ActionPlan.changes(old, now, TODAY);
        assertThat(changes).contains("STORE:-:", "MIX:2026-11-15:2/3");

        // Hết ngày mặn: chỉ còn việc bị bỏ, vẫn là đổi
        List<WaterDay> allSafe = new ArrayList<>();
        for (int i = 0; i < 8; i++) allSafe.add(safe(i));
        String calm = ActionPlan.digest(ActionPlan.waterActions(f, plan(allSafe, null), TODAY));
        assertThat(calm).isEmpty();
        assertThat(ActionPlan.changes(old, calm, TODAY)).isNotEmpty();
    }
}
