package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.WaterPlan;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.crop.Et0Monthly;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.crop.Et0MonthlyRepository;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WaterPlanServiceTest {

    private static final ZoneOffset VN = ZoneOffset.ofHours(7);
    private static final LocalDate TODAY = LocalDate.of(2026, 3, 10);
    private static final Instant NOW = OffsetDateTime.of(2026, 3, 10, 8, 0, 0, 0, VN).toInstant();

    @Mock FieldProfileRepository fieldRepository;
    @Mock StationWatchService watchService;
    @Mock Et0MonthlyRepository et0Repository;
    @InjectMocks WaterPlanService service;

    private final Station station = Station.builder().id(3L).name("Mỹ Tho").build();

    private static Crop crop(Crop.Category category, Double max, Double kc) {
        Crop crop = Crop.builder().code("dua").name("Dừa").category(category).build();
        crop.setStages(List.of(CropStage.builder().code("ca_nam").stageOrder(1).flexible(true)
                .maxSalinity(max).kc(kc).kcSource(kc == null ? null : "FAO 56").build()));
        return crop;
    }

    private FieldProfile field(Crop crop, Station station, boolean hasPond) {
        FieldProfile f = FieldProfile.builder().id(7L).name("Vườn").station(station).crop(crop)
                .areaHa(1.0).hasPond(hasPond).pondVolumeM3(300.0).build();
        when(fieldRepository.findById(7L)).thenReturn(Optional.of(f));
        return f;
    }

    private void salty() {
        List<SalinityForecast> forecasts = IntStream.rangeClosed(0, 7).mapToObj(i -> SalinityForecast.builder()
                .forecastDate(TODAY.plusDays(i)).predictedSalinity(i < 2 ? 1.0 : 6.0).build()).toList();
        when(watchService.snapshot(3L)).thenReturn(new StationSnapshot(
                Measurement.builder().value(1.0).recordedAt(TODAY.atStartOfDay().atOffset(VN)).build(), forecasts));
        when(et0Repository.findAll()).thenReturn(List.of(Et0Monthly.builder().month(3).et0MmDay(5.0).source("FAO").label("ước lượng").build()));
    }

    @Test
    void buildsThePlanFromTheStationSnapshotAndMonthlyEt0() {
        field(crop(Crop.Category.CROP, 2.0, 1.0), station, true);
        salty();

        WaterPlan plan = service.plan(7L, NOW).orElseThrow();
        assertThat(plan.days()).hasSize(8);
        assertThat(plan.pondSalinityAssumed()).isZero();
        assertThat(plan.days().get(2).status()).isEqualTo(com.aquamekong.service.field.WaterPlan.EXCEED);
        assertThat(plan.storage().unsafeDays()).isEqualTo(6);
        assertThat(plan.storage().dailyNeedM3()).isEqualTo(50.0);
        assertThat(plan.storage().pondVolumeM3()).isEqualTo(300.0);
        assertThat(plan.storage().pondDays()).isEqualTo(6);
        assertThat(plan.storage().fillBy()).isEqualTo(TODAY.plusDays(1));
        assertThat(plan.storage().et0Source()).isEqualTo("FAO");
        assertThat(plan.storage().et0Label()).isEqualTo("ước lượng");
        verify(watchService).snapshot(3L);
    }

    @Test
    void pondVolumeIsIgnoredWhenTheFieldHasNoPond() {
        field(crop(Crop.Category.CROP, 2.0, 1.0), station, false);
        salty();
        WaterPlan plan = service.plan(7L, NOW).orElseThrow();
        assertThat(plan.storage().pondVolumeM3()).isNull();
        assertThat(plan.storage().pondDays()).isZero();
    }

    @Test
    void cropWithoutKcGetsDaysButNoStorage() {
        field(crop(Crop.Category.CROP, 0.5, null), station, true);
        salty();
        WaterPlan plan = service.plan(7L, NOW).orElseThrow();
        assertThat(plan.days()).hasSize(8);
        assertThat(plan.storage()).isNull();
    }

    @Test
    void emptyWithoutStationOrThreshold() {
        field(crop(Crop.Category.CROP, 2.0, 1.0), null, true);
        assertThat(service.plan(7L, NOW)).isEmpty();

        field(crop(Crop.Category.AQUACULTURE, null, null), station, false);
        assertThat(service.plan(7L, NOW)).isEmpty();
        verifyNoInteractions(watchService);
    }

    @Test
    void unknownFieldIsNotFound() {
        when(fieldRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.plan(99L, NOW)).isInstanceOf(EntityNotFoundException.class);
    }
}
