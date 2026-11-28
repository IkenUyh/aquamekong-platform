package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.crop.CropRepository;
import com.aquamekong.repository.station.StationRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Tra nhanh cho chế độ Nông dân: kế hoạch việc cần làm theo trạm + cây (+ ngày gieo, số ngày giống) mà không khai
 * ruộng. Ruộng dùng chung toàn server nên không tạo ruộng tạm; hồ sơ chỉ dựng trong bộ nhớ, không lưu. Không có diện
 * tích, không có ao: việc nước nói "Không lấy nước sông", "Trữ nước ngọt (bồn, kênh nội đồng)", không có m³.
 */
@Service
@RequiredArgsConstructor
public class QuickPlanService {

    /** Cùng giới hạn với {@code FieldRequest.varietyDays} */
    static final int MAX_VARIETY_DAYS = 3650;

    private final StationRepository stationRepository;
    private final CropRepository cropRepository;
    private final FieldPlanService fieldPlanService;

    /** Rỗng khi không lập được (giai đoạn cây hôm nay không có ngưỡng) */
    @Transactional(readOnly = true)
    public Optional<FieldPlan> plan(Long stationId, String cropCode, LocalDate plantedOn, Integer varietyDays) {
        return plan(stationId, cropCode, plantedOn, varietyDays, Instant.now());
    }

    Optional<FieldPlan> plan(Long stationId, String cropCode, LocalDate plantedOn, Integer varietyDays, Instant now) {
        if (varietyDays != null && (varietyDays < 1 || varietyDays > MAX_VARIETY_DAYS)) {
            throw new IllegalArgumentException("Số ngày của giống phải từ 1 tới " + MAX_VARIETY_DAYS);
        }
        Station station = stationRepository.findById(stationId)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy trạm: " + stationId));
        String code = cropCode == null ? "" : cropCode.trim();
        Crop crop = cropRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("Không có loại cây: " + cropCode));
        FieldProfileService.validateSchedule(crop, plantedOn, varietyDays);

        FieldProfile field = FieldProfile.builder()
                .name(crop.getName())
                .station(station)
                .crop(crop)
                .plantedOn(plantedOn)
                .varietyDays(varietyDays)
                .hasPond(false)
                .build();
        return fieldPlanService.plan(field, now);
    }
}
