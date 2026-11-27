package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.FieldDto;
import com.aquamekong.dto.field.FieldDtos.FieldRequest;
import com.aquamekong.dto.field.FieldDtos.StageInfo;
import com.aquamekong.dto.watch.WatchDtos.Outlook;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.crop.CropRepository;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.service.crop.CropStages;
import com.aquamekong.service.crop.CropStages.CurrentStage;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Hồ sơ ruộng dùng chung toàn server (V16): ai cũng xem, khai, sửa, xoá được, kể cả khách chưa đăng nhập.
 * Ruộng do một tài khoản khai thì tự theo dõi trạm gần ruộng cho tài khoản đó (thông báo đẩy) với ngưỡng của cây ở
 * giai đoạn hiện tại; ruộng của khách không có thông báo. Ai xem cũng thấy tình hình mặn của trạm so với ngưỡng ruộng.
 */
@Service
@RequiredArgsConstructor
public class FieldProfileService {

    /** Giới hạn tổng số ruộng trên server: ai cũng khai được nên chặn việc tạo tràn lan */
    static final int MAX_FIELDS_TOTAL = 1000;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FieldProfileRepository fieldRepository;
    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final CropRepository cropRepository;
    private final StationWatchService watchService;

    /** @param username người đang xem, null = khách */
    @Transactional(readOnly = true)
    public List<FieldDto> list(String username) {
        Long viewerId = username == null ? null : userRepository.findByUsername(username).map(User::getId).orElse(null);
        LocalDate today = LocalDate.now(ZONE);
        Instant now = Instant.now();
        // Mỗi trạm chỉ đọc số đo và dự báo một lần dù nhiều ruộng cùng trạm
        Map<Long, StationSnapshot> snapshots = new HashMap<>();
        return fieldRepository.findAllByOrderByCreatedAtAsc().stream()
                .map(f -> toDto(f, viewerId, today, now, snapshots))
                .toList();
    }

    /** @param username người khai, null = khách (ruộng không có thông báo đẩy) */
    @Transactional
    public FieldDto create(String username, FieldRequest request) {
        if (fieldRepository.count() >= MAX_FIELDS_TOTAL) {
            throw new IllegalArgumentException("Đã đủ " + MAX_FIELDS_TOTAL + " ruộng trên hệ thống, không khai thêm được");
        }
        User owner = username == null ? null : userRepository.findByUsername(username).orElse(null);
        return save(FieldProfile.builder().user(owner).build(), request, owner == null ? null : owner.getId());
    }

    /** Ai cũng sửa được; ruộng giữ người khai ban đầu (người nhận thông báo) */
    @Transactional
    public FieldDto update(String username, Long id, FieldRequest request) {
        FieldProfile field = fieldRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy ruộng: " + id));
        Long viewerId = username == null ? null : userRepository.findByUsername(username).map(User::getId).orElse(null);
        return save(field, request, viewerId);
    }

    /** Ai cũng xoá được; theo dõi trạm của ruộng xoá theo (ON DELETE CASCADE) */
    @Transactional
    public void delete(Long id) {
        fieldRepository.findById(id).ifPresent(f -> {
            watchService.syncFieldWatch(f, null, null);
            fieldRepository.delete(f);
        });
    }

    private FieldDto save(FieldProfile field, FieldRequest request, Long viewerId) {
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

        CropStage stage = stage(saved, LocalDate.now(ZONE));
        // Chỉ ruộng có người khai mới theo dõi trạm (thông báo đẩy cần biết gửi cho ai)
        watchService.syncFieldWatch(saved, saved.getUser() == null || stage == null ? null : stage.getMaxSalinity(),
                stage == null ? null : stage.getMinSalinity());
        return toDto(saved, viewerId, LocalDate.now(ZONE), Instant.now(), new HashMap<>());
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

    private static CropStage stage(FieldProfile f, LocalDate today) {
        CurrentStage current = CropStages.current(f.getCrop().getStages(), f.getPlantedOn(), f.getVarietyDays(), today);
        return current == null ? null : current.stage();
    }

    private FieldDto toDto(FieldProfile f, Long viewerId, LocalDate today, Instant now, Map<Long, StationSnapshot> snapshots) {
        CurrentStage current = CropStages.current(f.getCrop().getStages(), f.getPlantedOn(), f.getVarietyDays(), today);
        CropStage stage = current == null ? null : current.stage();
        Double max = stage == null ? null : stage.getMaxSalinity();
        Double min = stage == null ? null : stage.getMinSalinity();
        Station station = f.getStation();
        Outlook outlook = station == null || max == null ? null : StationWatchService.outlook(
                snapshots.computeIfAbsent(station.getId(), watchService::snapshot), max, min, null, now);
        StageInfo stageInfo = current == null ? null : new StageInfo(stage.getCode(), stage.getName(),
                current.day(), current.beforePlanting(), current.pastHarvest());
        Long ownerId = f.getUser() == null ? null : f.getUser().getId();
        return new FieldDto(f.getId(), f.getName(), station == null ? null : station.getId(),
                station == null ? null : station.getName(), f.getCrop().getCode(), f.getCrop().getName(),
                f.getVariety(), f.getVarietyDays(), f.getPlantedOn(), f.getAreaHa(), f.isHasPond(), f.getPondVolumeM3(),
                stageInfo, max, min, outlook, viewerId != null && Objects.equals(ownerId, viewerId),
                ownerId != null && station != null && max != null);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
