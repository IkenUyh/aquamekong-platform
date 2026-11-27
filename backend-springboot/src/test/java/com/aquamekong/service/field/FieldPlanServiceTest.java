package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.field.FieldDtos.WaterDay;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.service.watch.StationWatchService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FieldPlanServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 14);
    private static final Instant NOW = OffsetDateTime.of(2026, 11, 14, 8, 0, 0, 0, ZoneOffset.ofHours(7)).toInstant();

    private final FieldProfileRepository fieldRepository = mock(FieldProfileRepository.class);
    private final WaterPlanService waterPlanService = mock(WaterPlanService.class);
    private final StationWatchService watchService = mock(StationWatchService.class);

    private final FieldProfile field = FieldProfile.builder().id(7L).name("Vườn").station(Station.builder().id(3L).build())
            .crop(crop()).hasPond(true).build();

    private static Crop crop() {
        Crop crop = Crop.builder().code("dua").name("Dừa").category(Crop.Category.CROP).build();
        crop.setStages(List.of(CropStage.builder().code("ca_nam").name("Cả năm").stageOrder(1).flexible(true)
                .maxSalinity(4.0).build()));
        return crop;
    }

    /** Hai ngày an toàn rồi mặn 8‰ (pha 1/2) tới hết cửa sổ */
    private static FieldDtos.WaterPlan saltyFromDay2() {
        List<WaterDay> days = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            boolean salty = i >= 2;
            days.add(new WaterDay(TODAY.plusDays(i), salty ? WaterPlan.EXCEED : WaterPlan.SAFE, salty ? 8.0 : 1.0, null,
                    false, 4.0, null, salty ? 0.5 : 0.0));
        }
        return new FieldDtos.WaterPlan(days, null, 0);
    }

    private FieldPlanService service(PlanContributor... extra) {
        List<PlanContributor> contributors = new ArrayList<>(List.of(new WaterPlanContributor()));
        contributors.addAll(List.of(extra));
        return new FieldPlanService(fieldRepository, waterPlanService, watchService, contributors);
    }

    @Test
    void combinesEveryContributorAndSortsByDate() {
        when(waterPlanService.plan(eq(field), any(), any(), eq(NOW))).thenReturn(Optional.of(saltyFromDay2()));
        PlanContributor fertilizer = (f, plan, today) -> List.of(new PlanAction("FERTILIZE", "MEDIUM", today.plusDays(1),
                today.plusDays(1), null, "Bón thúc trước khi mặn", "FERTILIZER"));

        FieldPlan plan = service(fertilizer).plan(field, id -> null, Map.of(), NOW).orElseThrow();

        assertThat(plan.verdict()).isEqualTo(ActionPlan.YELLOW);
        assertThat(plan.headline()).isEqualTo("Có, tới hết ngày 15/11; từ 16/11 nước sông mặn.");
        assertThat(plan.actions()).extracting(PlanAction::kind)
                .containsExactly(ActionPlan.STORE, "FERTILIZE", ActionPlan.MIX, ActionPlan.TAKE_WATER);
        assertThat(plan.waterPlan()).isNotNull();
    }

    @Test
    void aFailingContributorOnlyDropsItsOwnActions() {
        when(waterPlanService.plan(eq(field), any(), any(), eq(NOW))).thenReturn(Optional.of(saltyFromDay2()));
        PlanContributor broken = (f, plan, today) -> {
            throw new IllegalStateException("hỏng");
        };

        FieldPlan plan = service(broken).plan(field, id -> null, Map.of(), NOW).orElseThrow();

        assertThat(plan.actions()).isNotEmpty().allMatch(a -> ActionPlan.WATER.equals(a.source()));
    }

    @Test
    void emptyWhenThereIsNoWaterPlan() {
        when(waterPlanService.plan(eq(field), any(), any(), eq(NOW))).thenReturn(Optional.empty());
        assertThat(service().plan(field, id -> null, Map.of(), NOW)).isEmpty();
    }

    @Test
    void unknownFieldIsNotFound() {
        when(fieldRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().plan(99L)).isInstanceOf(EntityNotFoundException.class);
    }
}
