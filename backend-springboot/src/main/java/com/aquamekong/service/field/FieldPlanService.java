package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.field.FieldDtos.WaterPlan;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.service.field.WaterPlan.Et0;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * Kế hoạch việc cần làm của một ruộng: kế hoạch nước 7 ngày ({@link WaterPlanService}) cộng việc của mọi
 * {@link PlanContributor}, xếp theo ngày, kèm verdict và câu trả lời "Tuần này lấy nước được không?".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FieldPlanService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FieldProfileRepository fieldRepository;
    private final WaterPlanService waterPlanService;
    private final StationWatchService watchService;
    private final List<PlanContributor> contributors;

    /** Rỗng khi không lập được kế hoạch nước (ruộng không có trạm, giai đoạn hôm nay không có ngưỡng) */
    @Transactional(readOnly = true)
    public Optional<FieldPlan> plan(Long fieldId) {
        FieldProfile field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy ruộng: " + fieldId));
        return plan(field, Instant.now());
    }

    /**
     * Cho một ruộng đã nạp hoặc chưa lưu ({@link QuickPlanService}: chế độ Nông dân tra theo trạm + cây, không tạo
     * ruộng). Cây và giai đoạn phải nạp được (gọi trong transaction).
     */
    public Optional<FieldPlan> plan(FieldProfile field, Instant now) {
        return plan(field, watchService::snapshot, waterPlanService.et0ByMonth(), now);
    }

    /**
     * Cho nơi lập nhiều kế hoạch một lượt (khuyến nghị, job theo dõi trạm): mỗi trạm đọc một lần qua {@code snapshots},
     * ET₀ đọc một lần. Cây và giai đoạn của ruộng phải nạp sẵn khi gọi ngoài transaction.
     */
    public Optional<FieldPlan> plan(FieldProfile field, Function<Long, StationSnapshot> snapshots,
                                    Map<Integer, Et0> et0, Instant now) {
        LocalDate today = now.atZone(ZONE).toLocalDate();
        return waterPlanService.plan(field, snapshots, et0, now).map(water -> build(field, water, today));
    }

    public Map<Integer, Et0> et0ByMonth() {
        return waterPlanService.et0ByMonth();
    }

    FieldPlan build(FieldProfile field, WaterPlan water, LocalDate today) {
        List<PlanAction> actions = new ArrayList<>();
        for (PlanContributor contributor : contributors) {
            try {
                actions.addAll(contributor.actions(field, water, today));
            } catch (RuntimeException e) {
                // Một nguồn lỗi không làm mất cả kế hoạch
                log.warn("Bỏ việc của {} cho ruộng {}: {}", contributor.getClass().getSimpleName(), field.getId(),
                        e.getMessage(), e);
            }
        }
        return ActionPlan.plan(field, water, actions);
    }
}
