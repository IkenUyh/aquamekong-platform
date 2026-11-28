package com.aquamekong.controller.field;

import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.service.field.QuickPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** Chế độ Nông dân: "Tuần này lấy nước được không?" theo trạm + cây, không cần khai ruộng, không cần đăng nhập. */
@RestController
@RequestMapping("/api/v1/plan")
@RequiredArgsConstructor
@Tag(name = "Fields", description = "Hồ sơ ruộng dùng chung, không cần đăng nhập")
public class QuickPlanController {

    private final QuickPlanService quickPlanService;

    @GetMapping("/quick")
    @Operation(summary = "Kế hoạch việc cần làm theo trạm + cây, không lưu ruộng (không diện tích, không ao); 204 khi không lập được")
    public ResponseEntity<FieldPlan> quick(@RequestParam Long stationId, @RequestParam String cropCode,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plantedOn,
                                           @RequestParam(required = false) Integer varietyDays) {
        return quickPlanService.plan(stationId, cropCode, plantedOn, varietyDays)
                .map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }
}
