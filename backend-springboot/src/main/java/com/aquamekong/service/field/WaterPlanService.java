package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.Storage;
import com.aquamekong.dto.field.FieldDtos.WaterDay;
import com.aquamekong.dto.field.FieldDtos;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.repository.crop.Et0MonthlyRepository;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.service.crop.CropStages;
import com.aquamekong.service.crop.CropStages.CurrentStage;
import com.aquamekong.service.field.WaterPlan.Et0;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/** Kế hoạch nước 7 ngày tới của một ruộng: tình hình mặn ở trạm của ruộng, tính bằng {@link WaterPlan}. */
@Service
@RequiredArgsConstructor
public class WaterPlanService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FieldProfileRepository fieldRepository;
    private final StationWatchService watchService;
    private final Et0MonthlyRepository et0Repository;

    /** Rỗng khi ruộng không có trạm hoặc giai đoạn cây hôm nay không có ngưỡng */
    @Transactional(readOnly = true)
    public Optional<FieldDtos.WaterPlan> plan(Long fieldId) {
        return plan(fieldId, Instant.now());
    }

    Optional<FieldDtos.WaterPlan> plan(Long fieldId, Instant now) {
        FieldProfile field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy ruộng: " + fieldId));
        return plan(field, watchService::snapshot, et0ByMonth(), now);
    }

    /**
     * Như {@link #plan(Long)} cho một ruộng đã nạp, với nguồn số liệu trạm và ET₀ do nơi gọi đưa (lập nhiều ruộng một
     * lượt thì mỗi trạm chỉ đọc một lần).
     */
    public Optional<FieldDtos.WaterPlan> plan(FieldProfile field, Function<Long, StationSnapshot> snapshots,
                                              Map<Integer, Et0> et0, Instant now) {
        if (field.getStation() == null) return Optional.empty();
        CurrentStage current = CropStages.current(field.getCrop().getStages(), field.getPlantedOn(),
                field.getVarietyDays(), now.atZone(ZONE).toLocalDate());
        if (current == null || current.stage().getMaxSalinity() == null) return Optional.empty();

        List<WaterDay> days = WaterPlan.days(snapshots.apply(field.getStation().getId()), field.getCrop(),
                field.getPlantedOn(), field.getVarietyDays(), now);
        Storage storage = WaterPlan.storage(days, field.getCrop(), field.getPlantedOn(), field.getVarietyDays(),
                field.getAreaHa(), field.isHasPond() ? field.getPondVolumeM3() : null, et0);
        return Optional.of(new FieldDtos.WaterPlan(days, storage, WaterPlan.POND_SALINITY));
    }

    /** ET₀ theo tháng (1 – 12) */
    public Map<Integer, Et0> et0ByMonth() {
        Map<Integer, Et0> et0 = new HashMap<>();
        et0Repository.findAll().forEach(e -> et0.put(e.getMonth(), new Et0(e.getEt0MmDay(), e.getSource(), e.getLabel())));
        return et0;
    }
}
