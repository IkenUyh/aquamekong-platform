package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.FieldDto;
import com.aquamekong.dto.field.FieldDtos.FieldRequest;
import com.aquamekong.dto.field.FieldDtos.StageInfo;
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
import com.aquamekong.service.crop.CropStages;
import com.aquamekong.service.crop.CropStages.CurrentStage;
import com.aquamekong.service.watch.StationWatchService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Hồ sơ ruộng: người dùng khai một lần, các tính năng khác đọc từ đây. Lưu ruộng thì tự theo dõi trạm gần ruộng với
 * ngưỡng của cây ở giai đoạn hiện tại (bảng crops, V14).
 */
@Service
@RequiredArgsConstructor
public class FieldProfileService {

    static final int MAX_FIELDS_PER_USER = 20;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FieldProfileRepository fieldRepository;
    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final CropRepository cropRepository;
    private final StationWatchRepository watchRepository;
    private final StationWatchService watchService;

    @Transactional(readOnly = true)
    public List<FieldDto> list(String username) {
        User user = user(username);
        LocalDate today = LocalDate.now(ZONE);
        return fieldRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .map(f -> toDto(f, watchRepository.findByFieldProfileId(f.getId()).orElse(null), today))
                .toList();
    }

    @Transactional
    public FieldDto create(String username, FieldRequest request) {
        User user = user(username);
        if (fieldRepository.countByUserId(user.getId()) >= MAX_FIELDS_PER_USER) {
            throw new IllegalArgumentException("Chỉ khai được tối đa " + MAX_FIELDS_PER_USER + " ruộng");
        }
        return save(FieldProfile.builder().user(user).build(), request);
    }

    @Transactional
    public FieldDto update(String username, Long id, FieldRequest request) {
        return save(field(username, id), request);
    }

    /** Xoá ruộng; theo dõi trạm của ruộng xoá theo (ON DELETE CASCADE) */
    @Transactional
    public void delete(String username, Long id) {
        User user = user(username);
        fieldRepository.findByIdAndUserId(id, user.getId()).ifPresent(f -> {
            watchRepository.findByFieldProfileId(f.getId()).ifPresent(watchRepository::delete);
            fieldRepository.delete(f);
        });
    }

    private FieldDto save(FieldProfile field, FieldRequest request) {
        Station station = stationRepository.findById(request.stationId())
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy trạm: " + request.stationId()));
        Crop crop = cropRepository.findByCode(request.cropCode().trim())
                .orElseThrow(() -> new IllegalArgumentException("Không có loại cây: " + request.cropCode()));
        validateSchedule(crop, request);

        field.setName(request.name().trim());
        field.setStation(station);
        field.setCrop(crop);
        field.setVariety(blankToNull(request.variety()));
        field.setVarietyDays(request.varietyDays());
        field.setPlantedOn(request.plantedOn());
        field.setAreaHa(request.areaHa());
        field.setHasPond(request.hasPond());
        field.setPondVolumeM3(request.hasPond() ? request.pondVolumeM3() : null);
        FieldProfile saved = fieldRepository.save(field);

        LocalDate today = LocalDate.now(ZONE);
        CurrentStage current = CropStages.current(crop.getStages(), saved.getPlantedOn(), saved.getVarietyDays(), today);
        CropStage stage = current == null ? null : current.stage();
        StationWatch watch = watchService.syncFieldWatch(saved,
                stage == null ? null : stage.getMaxSalinity(), stage == null ? null : stage.getMinSalinity());
        return toDto(saved, watch, current);
    }

    /** Cây chia giai đoạn (lúa) cần ngày gieo và số ngày giống, dài hơn tổng các giai đoạn cố định */
    static void validateSchedule(Crop crop, FieldRequest request) {
        List<CropStage> stages = crop.getStages();
        if (!CropStages.needsSchedule(stages)) return;
        if (request.plantedOn() == null || request.varietyDays() == null) {
            throw new IllegalArgumentException("Cần ngày gieo và số ngày của giống để tính giai đoạn " + crop.getName().toLowerCase());
        }
        int fixed = CropStages.fixedDays(stages);
        if (request.varietyDays() <= fixed) {
            throw new IllegalArgumentException("Số ngày của giống phải lớn hơn " + fixed + " ngày");
        }
    }

    private FieldDto toDto(FieldProfile f, StationWatch watch, LocalDate today) {
        return toDto(f, watch, CropStages.current(f.getCrop().getStages(), f.getPlantedOn(), f.getVarietyDays(), today));
    }

    private static FieldDto toDto(FieldProfile f, StationWatch watch, CurrentStage current) {
        StageInfo stage = current == null ? null : new StageInfo(current.stage().getCode(), current.stage().getName(),
                current.day(), current.beforePlanting(), current.pastHarvest());
        Station station = f.getStation();
        return new FieldDto(f.getId(), f.getName(), station == null ? null : station.getId(),
                station == null ? null : station.getName(), f.getCrop().getCode(), f.getCrop().getName(),
                f.getVariety(), f.getVarietyDays(), f.getPlantedOn(), f.getAreaHa(), f.isHasPond(), f.getPondVolumeM3(),
                stage, watch == null ? null : watch.getId(), watch == null ? null : watch.getThreshold(),
                watch == null ? null : watch.getMinThreshold());
    }

    private FieldProfile field(String username, Long id) {
        User user = user(username);
        return fieldRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy ruộng: " + id));
    }

    private User user(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy người dùng: " + username));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
