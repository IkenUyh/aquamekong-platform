package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.FieldDto;
import com.aquamekong.dto.field.FieldDtos.FieldRequest;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.user.StationWatch;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.crop.CropRepository;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.user.StationWatchRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.service.watch.StationWatchService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
    @Mock StationWatchRepository watchRepository;
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

    @BeforeEach
    void setUp() {
        service = new FieldProfileService(fieldRepository, userRepository, stationRepository, cropRepository,
                watchRepository, watchService);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(stationRepository.findById(3L)).thenReturn(Optional.of(station));
        when(cropRepository.findByCode("lua")).thenReturn(Optional.of(rice));
        when(cropRepository.findByCode("tom_su")).thenReturn(Optional.of(shrimp));
        when(fieldRepository.save(any())).thenAnswer(i -> {
            FieldProfile f = i.getArgument(0);
            if (f.getId() == null) f.setId(9L);
            return f;
        });
        when(watchService.syncFieldWatch(any(), any(), any())).thenAnswer(i ->
                StationWatch.builder().id(5L).threshold(i.getArgument(1)).minThreshold(i.getArgument(2)).build());
    }

    private static FieldRequest rice(LocalDate sown, Integer days) {
        return new FieldRequest(" Ruộng sau nhà ", 3L, "lua", "OM18", days, sown, 1.5, true, 800.0);
    }

    @Test
    void creatingARiceFieldWatchesTheStationWithTheCurrentStageThreshold() {
        LocalDate sown = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(40);

        FieldDto dto = service.create("alice", rice(sown, 95));

        // Ngày 41 của giống 95 ngày: đẻ nhánh 30 ngày đã qua, đang làm đòng – trổ
        assertThat(dto.stage().code()).isEqualTo("lam_dong_tro");
        assertThat(dto.stage().day()).isEqualTo(41);
        assertThat(dto.name()).isEqualTo("Ruộng sau nhà");
        assertThat(dto.watchId()).isEqualTo(5L);
        verify(watchService).syncFieldWatch(any(FieldProfile.class), eq(4.0), isNull());
    }

    @Test
    void shrimpFieldWatchesARange() {
        FieldDto dto = service.create("alice",
                new FieldRequest("Ao tôm", 3L, "tom_su", null, null, null, 0.8, false, 500.0));

        verify(watchService).syncFieldWatch(any(FieldProfile.class), eq(35.0), eq(5.0));
        assertThat(dto.minThreshold()).isEqualTo(5.0);
        // Không có ao trữ thì không lưu dung tích ao
        assertThat(dto.pondVolumeM3()).isNull();
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
                new FieldRequest("Ruộng", 3L, "ca_phe", null, null, null, null, false, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void fieldCountIsLimited() {
        when(fieldRepository.countByUserId(1L)).thenReturn((long) FieldProfileService.MAX_FIELDS_PER_USER);

        assertThatThrownBy(() -> service.create("alice", rice(LocalDate.of(2026, 11, 1), 95)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void cannotEditSomeoneElsesField() {
        when(fieldRepository.findByIdAndUserId(9L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update("alice", 9L, rice(LocalDate.of(2026, 11, 1), 95)))
                .isInstanceOf(EntityNotFoundException.class);
        verify(fieldRepository, never()).save(any());
    }

    @Test
    void deletingAFieldDropsItsWatch() {
        FieldProfile field = FieldProfile.builder().id(9L).user(alice).build();
        StationWatch watch = StationWatch.builder().id(5L).build();
        when(fieldRepository.findByIdAndUserId(9L, 1L)).thenReturn(Optional.of(field));
        when(watchRepository.findByFieldProfileId(9L)).thenReturn(Optional.of(watch));

        service.delete("alice", 9L);

        verify(watchRepository).delete(watch);
        verify(fieldRepository).delete(field);
    }
}
