package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.field.FieldDtos.WaterDay;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.crop.CropRepository;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.service.watch.StationWatchService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class QuickPlanServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 14);
    private static final Instant NOW = OffsetDateTime.of(2026, 11, 14, 8, 0, 0, 0, ZoneOffset.ofHours(7)).toInstant();

    private final StationRepository stationRepository = mock(StationRepository.class);
    private final CropRepository cropRepository = mock(CropRepository.class);
    private final FieldProfileRepository fieldRepository = mock(FieldProfileRepository.class);
    private final WaterPlanService waterPlanService = mock(WaterPlanService.class);
    private final StationWatchService watchService = mock(StationWatchService.class);
    private QuickPlanService service;

    private final Station station = Station.builder().id(3L).name("Mỹ Tho").build();
    private final Crop rice = Crop.builder().code("lua").name("Lúa").category(Crop.Category.CROP).stages(List.of(
            CropStage.builder().code("ma").name("Mạ").stageOrder(1).durationDays(20).maxSalinity(2.0).build(),
            CropStage.builder().code("de_nhanh").name("Đẻ nhánh").stageOrder(2).flexible(true).maxSalinity(4.0).build(),
            CropStage.builder().code("lam_dong_tro").name("Làm đòng – trổ").stageOrder(3).durationDays(35).maxSalinity(4.0).build(),
            CropStage.builder().code("chin").name("Chín").stageOrder(4).durationDays(30).maxSalinity(4.0).build())).build();
    private final Crop coconut = Crop.builder().code("dua").name("Dừa").category(Crop.Category.CROP).stages(List.of(
            CropStage.builder().code("ca_nam").name("Cả năm").stageOrder(1).flexible(true).maxSalinity(4.0).build())).build();

    @BeforeEach
    void setUp() {
        FieldPlanService fieldPlanService = new FieldPlanService(fieldRepository, waterPlanService, watchService,
                List.of(new WaterPlanContributor()));
        service = new QuickPlanService(stationRepository, cropRepository, fieldPlanService);
        when(stationRepository.findById(3L)).thenReturn(Optional.of(station));
        when(cropRepository.findByCode("lua")).thenReturn(Optional.of(rice));
        when(cropRepository.findByCode("dua")).thenReturn(Optional.of(coconut));
    }

    /** Hai ngày an toàn rồi mặn 8‰ tới hết cửa sổ */
    private static FieldDtos.WaterPlan saltyFromDay2() {
        List<WaterDay> days = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            boolean salty = i >= 2;
            days.add(new WaterDay(TODAY.plusDays(i), salty ? WaterPlan.EXCEED : WaterPlan.SAFE, salty ? 8.0 : 1.0, null,
                    false, 4.0, null, salty ? 0.5 : 0.0));
        }
        return new FieldDtos.WaterPlan(days, null, 0);
    }

    @Test
    void plansAnUnsavedFieldWithoutPondOrArea() {
        when(waterPlanService.plan(any(FieldProfile.class), any(), any(), eq(NOW))).thenReturn(Optional.of(saltyFromDay2()));

        FieldPlan plan = service.plan(3L, " dua ", null, null, NOW).orElseThrow();

        ArgumentCaptor<FieldProfile> field = ArgumentCaptor.forClass(FieldProfile.class);
        verify(waterPlanService).plan(field.capture(), any(), any(), eq(NOW));
        assertThat(field.getValue().getId()).isNull();
        assertThat(field.getValue().getUser()).isNull();
        assertThat(field.getValue().getStation()).isSameAs(station);
        assertThat(field.getValue().getCrop()).isSameAs(coconut);
        assertThat(field.getValue().isHasPond()).isFalse();
        assertThat(field.getValue().getAreaHa()).isNull();
        // Không ghi gì vào bảng ruộng dùng chung
        verifyNoInteractions(fieldRepository);

        assertThat(plan.verdict()).isEqualTo(ActionPlan.YELLOW);
        // Không có ao: không pha, chỉ ngừng lấy nước sông và trữ bồn/kênh
        assertThat(plan.actions()).extracting(PlanAction::kind)
                .contains(ActionPlan.STORE, ActionPlan.STOP_INTAKE).doesNotContain(ActionPlan.MIX, ActionPlan.POND_ONLY);
        assertThat(plan.actions()).filteredOn(a -> ActionPlan.STORE.equals(a.kind()))
                .allMatch(a -> a.message().contains("bồn, kênh nội đồng"));
    }

    @Test
    void passesTheRiceScheduleThrough() {
        when(waterPlanService.plan(any(FieldProfile.class), any(), any(), eq(NOW))).thenReturn(Optional.of(saltyFromDay2()));
        LocalDate sown = LocalDate.of(2026, 11, 1);

        assertThat(service.plan(3L, "lua", sown, 95, NOW)).isPresent();

        ArgumentCaptor<FieldProfile> field = ArgumentCaptor.forClass(FieldProfile.class);
        verify(waterPlanService).plan(field.capture(), any(), any(), eq(NOW));
        assertThat(field.getValue().getPlantedOn()).isEqualTo(sown);
        assertThat(field.getValue().getVarietyDays()).isEqualTo(95);
    }

    @Test
    void emptyWhenNoPlanCanBeMade() {
        when(waterPlanService.plan(any(FieldProfile.class), any(), any(), eq(NOW))).thenReturn(Optional.empty());
        assertThat(service.plan(3L, "dua", null, null, NOW)).isEmpty();
    }

    @Test
    void riceNeedsSowingDateAndVarietyLongerThanTheFixedStages() {
        assertThatThrownBy(() -> service.plan(3L, "lua", null, 95, NOW))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("ngày gieo");
        assertThatThrownBy(() -> service.plan(3L, "lua", LocalDate.of(2026, 11, 1), null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.plan(3L, "lua", LocalDate.of(2026, 11, 1), 80, NOW))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("85");
        verifyNoInteractions(waterPlanService);
    }

    @Test
    void rejectsOutOfRangeVarietyDaysUnknownStationAndUnknownCrop() {
        assertThatThrownBy(() -> service.plan(3L, "dua", null, 0, NOW)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.plan(3L, "dua", null, 4000, NOW)).isInstanceOf(IllegalArgumentException.class);
        when(stationRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.plan(99L, "dua", null, null, NOW)).isInstanceOf(EntityNotFoundException.class);
        when(cropRepository.findByCode("xyz")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.plan(3L, "xyz", null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("xyz");
        verifyNoInteractions(waterPlanService);
    }
}
