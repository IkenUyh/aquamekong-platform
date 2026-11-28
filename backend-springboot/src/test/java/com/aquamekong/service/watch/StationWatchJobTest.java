package com.aquamekong.service.watch;

import com.aquamekong.dto.watch.WatchDtos.Outlook;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.entity.user.StationWatch;
import com.aquamekong.entity.user.User;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.repository.user.StationWatchRepository;
import com.aquamekong.service.field.ActionPlan;
import com.aquamekong.service.field.FieldPlanService;
import com.aquamekong.service.push.PushMessage;
import com.aquamekong.service.push.PushService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StationWatchJobTest {

    @Mock StationWatchRepository watchRepository;
    @Mock StationWatchService watchService;
    @Mock PushService pushService;
    @Mock FieldPlanService fieldPlanService;

    private final Station station = Station.builder().id(3L).name("Mỹ Tho").build();

    private StationWatch watch(long id, long userId, double threshold, boolean exceeding) {
        return StationWatch.builder().id(id).user(User.builder().id(userId).build()).station(station)
                .threshold(threshold).crop("Lúa").forecastExceeding(exceeding).build();
    }

    @Test
    void reportsOnlyWatchesWhoseStateChanged() {
        // Số đo mới (hôm nay) 2,5‰: vượt ngưỡng 2 (lúa), dưới ngưỡng 4
        when(watchService.snapshot(3L)).thenReturn(new StationSnapshot(
                Measurement.builder().value(2.5).recordedAt(OffsetDateTime.now()).build(), List.of()));
        StationWatch startsExceeding = watch(1, 10, 2.0, false);
        StationWatch stillExceeding = watch(2, 11, 1.0, true);
        StationWatch backBelow = watch(3, 12, 4.0, true);
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(startsExceeding, stillExceeding, backBelow));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        // Một trạm chỉ đọc số đo/dự báo một lần cho mọi người theo dõi
        verify(watchService, times(1)).snapshot(3L);
        verify(pushService).notifyUser(eq(10L), any());
        verify(pushService).notifyUser(eq(12L), any());
        verify(pushService, never()).notifyUser(eq(11L), any());
        assertThat(startsExceeding.isForecastExceeding()).isTrue();
        assertThat(backBelow.isForecastExceeding()).isFalse();
        verify(watchRepository).saveAll(List.of(startsExceeding, backBelow));
    }

    @Test
    void forecastMessageTellsWhenToStoreWater() {
        PushMessage message = StationWatchJob.message(watch(1, 10, 2.0, false),
                new Outlook(1.2, OffsetDateTime.of(2026, 10, 8, 0, 0, 0, 0, ZoneOffset.ofHours(7)),
                        LocalDate.of(2026, 10, 12), 2.85, null, null, null, true, null, null));

        assertThat(message.title()).isEqualTo("Cảnh báo mặn: Mỹ Tho");
        assertThat(message.body()).isEqualTo("Dự báo vượt 2‰ cho lúa từ ngày 12/10, cao nhất 2,85‰. Nên trữ nước ngọt trước ngày này.");
    }

    @Test
    void backBelowMessageSaysWaterCanBeTaken() {
        PushMessage message = StationWatchJob.message(watch(1, 10, 2.0, true),
                new Outlook(1.2, null, null, 1.5, null, 1.9, null, false, null, null));

        assertThat(message.title()).isEqualTo("Độ mặn đã giảm: Mỹ Tho");
        assertThat(message.body()).contains("dưới ngưỡng 2‰ cho lúa");
    }

    @Test
    void riskMessageWarnsBeforeTheForecastItself() {
        PushMessage message = StationWatchJob.message(watch(1, 10, 2.0, false),
                new Outlook(1.2, OffsetDateTime.of(2026, 10, 8, 0, 0, 0, 0, ZoneOffset.ofHours(7)),
                        null, 1.2, LocalDate.of(2026, 10, 11), 2.6, LocalDate.of(2026, 10, 13), true, null, null));

        assertThat(message.title()).isEqualTo("Nguy cơ mặn: Mỹ Tho");
        assertThat(message.body()).isEqualTo("Có thể vượt 2‰ cho lúa từ ngày 11/10 (có thể lên tới 2,6‰). Nên trữ nước ngọt trước ngày này.");
    }

    private StationWatch shrimpWatch(boolean exceeding) {
        return StationWatch.builder().id(1L).user(User.builder().id(10L).build()).station(station)
                .threshold(35.0).minThreshold(5.0).crop("Nuôi tôm sú").forecastExceeding(exceeding).build();
    }

    @Test
    void lowSalinityMessageForARangeWatch() {
        PushMessage message = StationWatchJob.message(shrimpWatch(false),
                new Outlook(4.2, OffsetDateTime.of(2026, 10, 8, 0, 0, 0, 0, ZoneOffset.ofHours(7)),
                        null, 6.0, null, null, null, true, LocalDate.of(2026, 10, 10), 3.1));

        assertThat(message.title()).isEqualTo("Độ mặn thấp: Mỹ Tho");
        assertThat(message.body()).isEqualTo("Độ mặn đo ngày 08/10 là 4,2‰, dưới mức tối thiểu 5‰ cho nuôi tôm sú."
                + " Dự báo xuống dưới 5‰ từ ngày 10/10, thấp nhất 3,1‰.");
    }

    @Test
    void backInRangeMessageGivesTheRange() {
        PushMessage message = StationWatchJob.message(shrimpWatch(true),
                new Outlook(12.0, null, null, 14.0, null, null, null, false, null, 10.0));

        assertThat(message.title()).isEqualTo("Độ mặn đã ổn định: Mỹ Tho");
        assertThat(message.body()).contains("trong khoảng 5–35‰ cho nuôi tôm sú");
    }

    /** Ruộng lúa giống 95 ngày gieo cách đây 40 ngày: hôm nay đang làm đòng – trổ (4‰) */
    private StationWatch riceFieldWatch(double threshold, boolean exceeding) {
        Crop rice = Crop.builder().name("Lúa").stages(List.of(
                CropStage.builder().code("de_nhanh").stageOrder(1).flexible(true).maxSalinity(3.0).build(),
                CropStage.builder().code("lam_dong_tro").stageOrder(2).durationDays(35).maxSalinity(4.0).build(),
                CropStage.builder().code("chin").stageOrder(3).durationDays(30).maxSalinity(4.0).build())).build();
        FieldProfile field = FieldProfile.builder().id(9L).name("Ruộng sau nhà").crop(rice).varietyDays(95)
                .plantedOn(LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(40)).build();
        return StationWatch.builder().id(1L).user(User.builder().id(10L).build()).station(station).crop("Lúa")
                .fieldProfile(field).threshold(threshold).forecastExceeding(exceeding).build();
    }

    @Test
    void fieldWatchFollowsTheCropStage() {
        StationWatch watch = riceFieldWatch(3.0, false);

        assertThat(StationWatchJob.applyStageThreshold(watch, LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")))).isTrue();
        assertThat(watch.getThreshold()).isEqualTo(4.0);
        assertThat(StationWatchJob.applyStageThreshold(watch, LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")))).isFalse();
        // Theo dõi đặt tay không đổi
        assertThat(StationWatchJob.applyStageThreshold(watch(2, 11, 1.0, false), LocalDate.now())).isFalse();
    }

    @Test
    void newStageThresholdIsSavedAndComparedTheSameRun() {
        // 3,5‰: vượt ngưỡng đẻ nhánh cũ (3‰) nhưng dưới ngưỡng làm đòng – trổ (4‰)
        when(watchService.snapshot(3L)).thenReturn(new StationSnapshot(
                Measurement.builder().value(3.5).recordedAt(OffsetDateTime.now()).build(), List.of()));
        StationWatch quiet = riceFieldWatch(3.0, false);
        StationWatch wasExceeding = riceFieldWatch(3.0, true);
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(quiet, wasExceeding));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        // Ngưỡng mới lưu cho cả hai; ruộng đang báo vượt thì nay báo "đã giảm" theo ngưỡng mới
        assertThat(quiet.getThreshold()).isEqualTo(4.0);
        assertThat(wasExceeding.isForecastExceeding()).isFalse();
        verify(pushService, times(1)).notifyUser(eq(10L), any());
        verify(watchRepository).saveAll(List.of(quiet, wasExceeding));
    }

    @Test
    void storesTheRiskWindowWithoutReportingWhenTheStateStaysTheSame() {
        LocalDate tomorrow = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1);
        when(watchService.snapshot(3L)).thenReturn(new StationSnapshot(
                Measurement.builder().value(1.0).recordedAt(OffsetDateTime.now()).build(),
                List.of(com.aquamekong.entity.forecast.SalinityForecast.builder()
                        .forecastDate(tomorrow).predictedSalinity(1.0).riskSalinity(2.4).build())));
        StationWatch alreadyWarned = watch(1, 10, 2.0, true);
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(alreadyWarned));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        verify(pushService, never()).notifyUser(any(), any());
        assertThat(alreadyWarned.getRiskUntil()).isEqualTo(tomorrow);
        verify(watchRepository).saveAll(List.of(alreadyWarned));
    }

    // ---- Kế hoạch nước của ruộng ----

    private static final LocalDate TODAY = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    private static PlanAction store(LocalDate by) {
        return new PlanAction(ActionPlan.STORE, ActionPlan.HIGH, by, by, null,
                "Trữ đầy ao trước hết ngày " + by.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM")), ActionPlan.WATER);
    }

    private static PlanAction mix(LocalDate from, LocalDate until, double fraction) {
        return new PlanAction(ActionPlan.MIX, ActionPlan.MEDIUM, from, until, fraction, "Pha nước ao", ActionPlan.WATER);
    }

    private static PlanAction takeWater(LocalDate from, LocalDate until) {
        return new PlanAction(ActionPlan.TAKE_WATER, ActionPlan.LOW, from, until, null, "Lấy nước được", ActionPlan.WATER);
    }

    private void planIs(StationWatch watch, PlanAction... actions) {
        when(fieldPlanService.plan(eq(watch.getFieldProfile()), any(), any(), any()))
                .thenReturn(Optional.of(new FieldPlan(ActionPlan.YELLOW, "Có, tới hết ngày...", List.of(actions), null)));
    }

    private void reading(double value) {
        when(watchService.snapshot(3L)).thenReturn(new StationSnapshot(
                Measurement.builder().value(value).recordedAt(OffsetDateTime.now()).build(), List.of()));
    }

    @Test
    void digestChangeSendsExactlyOnePlanPush() {
        reading(1.0);
        StationWatch watch = riceFieldWatch(4.0, false);
        watch.setPlanDigest(ActionPlan.digest(List.of(store(TODAY.plusDays(3)), mix(TODAY.plusDays(4), TODAY.plusDays(6), 0.5))));
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(watch));
        // Mặn tới sớm hơn: trữ trước hôm nay + 1
        planIs(watch, store(TODAY.plusDays(1)), mix(TODAY.plusDays(2), TODAY.plusDays(6), 0.5), takeWater(TODAY, TODAY.plusDays(1)));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        ArgumentCaptor<PushMessage> sent = ArgumentCaptor.forClass(PushMessage.class);
        verify(pushService, times(1)).notifyUser(eq(10L), sent.capture());
        assertThat(sent.getValue().title()).isEqualTo("Kế hoạch nước đổi: Ruộng sau nhà");
        assertThat(sent.getValue().body()).startsWith("Trữ đầy ao trước hết ngày ");
        assertThat(sent.getValue().body()).doesNotContain("Lấy nước được");
        assertThat(sent.getValue().url()).isEqualTo("/fields");
        assertThat(watch.getPlanDigest()).contains("STORE:" + TODAY.plusDays(1));
        verify(watchRepository).saveAll(List.of(watch));
    }

    @Test
    void slidingWindowWithNothingNewDoesNotPush() {
        reading(1.0);
        StationWatch watch = riceFieldWatch(4.0, false);
        // Hôm qua: mặn từ hôm nay + 2 tới hết cửa sổ (hôm qua + 7)
        watch.setPlanDigest(ActionPlan.digest(List.of(store(TODAY.plusDays(1)), mix(TODAY.plusDays(2), TODAY.plusDays(6), 0.5))));
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(watch));
        // Hôm nay: cửa sổ dài thêm một ngày, ngày lấy được nước đổi; việc quan trọng vẫn vậy
        planIs(watch, store(TODAY.plusDays(1)), mix(TODAY.plusDays(2), TODAY.plusDays(7), 0.5), takeWater(TODAY, TODAY.plusDays(1)));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        verify(pushService, never()).notifyUser(any(), any());
        // Vẫn lưu dấu vân tay mới (ngày cuối đã đổi)
        assertThat(watch.getPlanDigest()).contains(TODAY.plusDays(7).toString());
        verify(watchRepository).saveAll(List.of(watch));
    }

    @Test
    void stateAndPlanChangeTogetherSendOnePush() {
        reading(5.0); // vượt ngưỡng 4‰
        StationWatch watch = riceFieldWatch(4.0, false);
        watch.setPlanDigest(ActionPlan.digest(List.of(store(TODAY.plusDays(3)))));
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(watch));
        planIs(watch, mix(TODAY, TODAY.plusDays(3), 0.25));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        ArgumentCaptor<PushMessage> sent = ArgumentCaptor.forClass(PushMessage.class);
        verify(pushService, times(1)).notifyUser(eq(10L), sent.capture());
        assertThat(sent.getValue().title()).startsWith("Kế hoạch nước đổi");
        assertThat(watch.isForecastExceeding()).isTrue();
    }

    @Test
    void firstPlanIsStoredWithoutPushing() {
        reading(1.0);
        StationWatch watch = riceFieldWatch(4.0, false);
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(watch));
        planIs(watch, store(TODAY.plusDays(1)));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        verify(pushService, never()).notifyUser(any(), any());
        assertThat(watch.getPlanDigest()).isEqualTo("STORE:" + TODAY.plusDays(1) + ":" + TODAY.plusDays(1) + ":");
    }

    @Test
    void manualWatchIgnoresPlans() {
        reading(2.5);
        StationWatch manual = watch(1, 10, 2.0, false);
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(manual));

        new StationWatchJob(watchRepository, watchService, pushService, fieldPlanService).check();

        verifyNoInteractions(fieldPlanService);
        ArgumentCaptor<PushMessage> sent = ArgumentCaptor.forClass(PushMessage.class);
        verify(pushService, times(1)).notifyUser(eq(10L), sent.capture());
        assertThat(sent.getValue().title()).isEqualTo("Cảnh báo mặn: Mỹ Tho");
        assertThat(manual.getPlanDigest()).isNull();
    }
}
