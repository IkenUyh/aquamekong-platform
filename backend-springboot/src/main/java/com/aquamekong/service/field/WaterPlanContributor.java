package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.field.FieldDtos.WaterPlan;
import com.aquamekong.entity.field.FieldProfile;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/** Việc cần làm từ kế hoạch nước: trữ, pha, ngừng lấy nước sông, đo mặn, ao cạn, đổi giai đoạn, ngày lấy được nước */
@Component
public class WaterPlanContributor implements PlanContributor {

    @Override
    public List<PlanAction> actions(FieldProfile field, WaterPlan plan, LocalDate today) {
        return ActionPlan.waterActions(field, plan, today);
    }
}
