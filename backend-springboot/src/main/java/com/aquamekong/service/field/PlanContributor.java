package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.field.FieldDtos.WaterPlan;
import com.aquamekong.entity.field.FieldProfile;

import java.time.LocalDate;
import java.util.List;

/**
 * Một nguồn việc cần làm cho kế hoạch của ruộng. Spring gom mọi bean cài interface này vào {@link FieldPlanService}:
 * kế hoạch nước là {@link WaterPlanContributor} (source WATER); bón phân thêm một bean với source FERTILIZER.
 * Lỗi của một nguồn chỉ bỏ việc của nguồn đó, kế hoạch vẫn trả về. Chỉ việc của WATER làm đổi dấu vân tay để báo đẩy.
 */
public interface PlanContributor {

    /**
     * @param field ruộng, kèm cây và giai đoạn đã nạp
     * @param plan  kế hoạch nước 7 ngày tới (hôm nay .. hôm nay + 7) của ruộng
     * @param today ngày hôm nay giờ Việt Nam
     */
    List<PlanAction> actions(FieldProfile field, WaterPlan plan, LocalDate today);
}
