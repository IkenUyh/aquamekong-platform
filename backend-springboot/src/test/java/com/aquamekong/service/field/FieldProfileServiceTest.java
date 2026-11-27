package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.FieldDto;
import com.aquamekong.dto.field.FieldDtos.FieldRequest;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.crop.CropRepository;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FieldProfileServiceTest {

    @Mock FieldProfileRepository fieldRepository;
    @Mock UserRepository userRepository;
    @Mock StationRepository stationRepository;
    @Mock CropRepository cropRepository;
    @Mock StationWatchService watchService;
    FieldProfileService service;

    private final User alice = User.builder().id(1L).username("alice").build();
    private final Station station = Station.builder().id(3L).name("Mỹ Tho").build();
    private final Crop rice = Crop.builder().code("lua").name("Lúa").category(Crop.Category.CROP).stages(List.of(
            CropStage.builder().code("ma").name("Mạ").stageOrder(1).maxSalinity(1.0).build(),
            CropStage.builder().code("de_nhanh").name("Đẻ nhánh").stageOrder(2).flexible(true).maxSalinity(4.0).build(),
            CropStage.builder().code("lam_dong_tro").name("Làm đòng – trổ").stageOrder(3).durationDays(35).maxSalinity(4.0).build(),
            CropStage.builder().code("chin").name("Chín").stageOrder(4).durationDays(30).maxSalinity(4.0).build())).build();
    private final Crop shrimp = Crop.builder().code("tom_su").name("Nuôi tôm sú").category(Crop.Category.AQUACULTURE)
            .stages(List.of(CropStage.builder().code("ca_vu").name("Cả vụ").stageOrder(1).flexible(true)
                    .maxSalinity(35.0).minSalinity(5.0).build())).build();
    private final Crop basa = Crop.builder().code("ca_basa").name("Nuôi cá basa").category(Crop.Category.AQUACULTURE)
            .stages(List.of(CropStage.builder().code("ca_vu").name("Cả vụ").stageOrder(1).flexible(true).build())).build();

    @BeforeEach
    void setUp() {
        service = new FieldProfileService(fieldRepository, userRepository, stationRepository, cropRepository, watchService);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(stationRepository.findById(3L)).thenReturn(Optional.of(station));
        when(cropRepository.findByCode("lua")).thenReturn(Optional.of(rice));
        when(cropRepository.findByCode("tom_su")).thenReturn(Optional.of(shrimp));
        when(cropRepository.findByCode("ca_basa")).thenReturn(Optional.of(basa));
        when(watchService.snapshot(3L)).thenReturn(new StationSnapshot(
                Measurement.builder().value(4.5).recordedAt(OffsetDateTime.now()).build(), List.of()));
        when(fieldRepository.save(any())).thenAnswer(i -> {
            FieldProfile f = i.getArgument(0);
            if (f.getId() == null) f.setId(9L);
            return f;
        });
    }

    private static FieldRequest rice(LocalDate sown, Integer days) {
        return new FieldRequest(" Ruộng sau nhà ", 3L, "lua", "OM18", days, sown, 1.5, true, 800.0, null, null);
    }

    @Test
    void signedInUserGetsTheStationWatchedWithTheCurrentStageThreshold() {
        LocalDate sown = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(40);

        FieldDto dto = service.create("alice", rice(sown, 95));

        // Ngày 41 của giống 95 ngày: đẻ nhánh 30 ngày đã qua, đang làm đòng – trổ
        assertThat(dto.stage().code()).isEqualTo("lam_dong_tro");
        assertThat(dto.stage().day()).isEqualTo(41);
        assertThat(dto.name()).isEqualTo("Ruộng sau nhà");
        assertThat(dto.mine()).isTrue();
        assertThat(dto.notified()).isTrue();
        // Ai xem cũng thấy tình hình mặn: 4,5‰ vượt ngưỡng 4‰
        assertThat(dto.threshold()).isEqualTo(4.0);
        assertThat(dto.outlook().exceeding()).isTrue();
        verify(watchService).syncFieldWatch(argThat(f -> f.getUser() == alice), eq(4.0), isNull());
    }

    @Test
    void guestCanAddAFieldWithoutNotifications() {
        FieldDto dto = service.create(null, new FieldRequest("Ao tôm", 3L, "tom_su", null, null, null, 0.8, false, 500.0, null, null));

        assertThat(dto.mine()).isFalse();
        assertThat(dto.notified()).isFalse();
        assertThat(dto.minThreshold()).isEqualTo(5.0);
        // Không có ao trữ thì không lưu dung tích ao
        assertThat(dto.pondVolumeM3()).isNull();
        // Không có người khai: không theo dõi trạm
        verify(watchService).syncFieldWatch(argThat(f -> f.getUser() == null), isNull(), eq(5.0));
    }

    @Test
    void speciesWithoutASourceHasNoThresholdOrOutlook() {
        FieldDto dto = service.create("alice", new FieldRequest("Ao basa", 3L, "ca_basa", null, null, null, null, false, null, null, null));

        assertThat(dto.threshold()).isNull();
        assertThat(dto.outlook()).isNull();
        assertThat(dto.notified()).isFalse();
    }

    @Test
    void anyoneCanEditAFieldAndItKeepsItsOwner() {
        FieldProfile owned = FieldProfile.builder().id(9L).user(alice).name("Ruộng").station(station).crop(shrimp).build();
        when(fieldRepository.findById(9L)).thenReturn(Optional.of(owned));

        FieldDto dto = service.update(null, 9L, new FieldRequest("Ao tôm mới", 3L, "tom_su", null, null, null, null, false, null, null, null));

        assertThat(dto.name()).isEqualTo("Ao tôm mới");
        assertThat(owned.getUser()).isSameAs(alice);
        assertThat(dto.mine()).isFalse();
        assertThat(dto.notified()).isTrue();
    }

    @Test
    void listShowsEveryFieldAndReadsEachStationOnce() {
        FieldProfile a = FieldProfile.builder().id(1L).user(alice).name("A").station(station).crop(shrimp).build();
        FieldProfile b = FieldProfile.builder().id(2L).name("B").station(station).crop(shrimp).build();
        when(fieldRepository.findAllByOrderByCreatedAtAsc()).thenReturn(List.of(a, b));

        List<FieldDto> list = service.list(null);

        assertThat(list).extracting(FieldDto::name).containsExactly("A", "B");
        // 4,5‰ dưới cận dưới 5‰ của tôm sú: cả hai ao đều ra ngoài khoảng
        assertThat(list).allMatch(f -> f.outlook() != null && f.outlook().exceeding());
        verify(watchService, times(1)).snapshot(3L);
    }

    @Test
    void riceNeedsSowingDateAndVarietyLongerThanTheFixedStages() {
        assertThatThrownBy(() -> service.create("alice", rice(null, 95)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("ngày gieo");
        assertThatThrownBy(() -> service.create("alice", rice(LocalDate.of(2026, 11, 1), 65)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("65");
        verify(fieldRepository, never()).save(any());
    }

    @Test
    void unknownCropIsRejected() {
        assertThatThrownBy(() -> service.create("alice",
                new FieldRequest("Ruộng", 3L, "ca_phe", null, null, null, null, false, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void totalFieldCountIsCapped() {
        when(fieldRepository.count()).thenReturn((long) FieldProfileService.MAX_FIELDS_TOTAL);

        assertThatThrownBy(() -> service.create(null, rice(LocalDate.of(2026, 11, 1), 95)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unknownFieldIsNotFound() {
        when(fieldRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(null, 9L, rice(LocalDate.of(2026, 11, 1), 95)))
                .isInstanceOf(EntityNotFoundException.class);
        verify(fieldRepository, never()).save(any());
    }

    @Test
    void deletingAFieldDropsItsWatch() {
        FieldProfile field = FieldProfile.builder().id(9L).user(alice).build();
        when(fieldRepository.findById(9L)).thenReturn(Optional.of(field));

        service.delete(9L);

        verify(watchService).syncFieldWatch(field, null, null);
        verify(fieldRepository).delete(field);
    }
}
