package com.aquamekong.controller.field;

import com.aquamekong.dto.field.FieldDtos.Exposure;
import com.aquamekong.dto.field.FieldDtos.FieldDto;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.FieldRequest;
import com.aquamekong.dto.field.FieldDtos.WaterPlan;
import com.aquamekong.service.field.FieldPlanService;
import com.aquamekong.service.field.FieldProfileService;
import com.aquamekong.service.field.SalinityExposureService;
import com.aquamekong.service.field.WaterPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Hồ sơ ruộng dùng chung toàn server: không cần đăng nhập. Đăng nhập thì ruộng mình khai có thông báo đẩy. */
@RestController
@RequestMapping("/api/v1/fields")
@RequiredArgsConstructor
@Tag(name = "Fields", description = "Hồ sơ ruộng dùng chung, không cần đăng nhập")
public class FieldProfileController {

    private final FieldProfileService fieldService;
    private final SalinityExposureService exposureService;
    private final WaterPlanService waterPlanService;
    private final FieldPlanService fieldPlanService;

    @GetMapping
    @Operation(summary = "Mọi ruộng đã khai, kèm giai đoạn cây, ngưỡng và tình hình mặn của trạm")
    public ResponseEntity<List<FieldDto>> list(Authentication authentication) {
        return ResponseEntity.ok(fieldService.list(username(authentication)));
    }

    @GetMapping("/{id}/exposure")
    @Operation(summary = "Mức mặn cây đã chịu trong mùa và năng suất có thể giảm (FAO 29); 204 khi không tính được")
    public ResponseEntity<Exposure> exposure(@PathVariable Long id) {
        return exposureService.exposure(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}/water-plan")
    @Operation(summary = "Kế hoạch nước 7 ngày tới: ngày lấy được nước sông, tỷ lệ pha, ao đủ bao lâu; 204 khi ruộng không có trạm hoặc ngưỡng")
    public ResponseEntity<WaterPlan> waterPlan(@PathVariable Long id) {
        return waterPlanService.plan(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}/plan")
    @Operation(summary = "Kế hoạch việc cần làm có ngày (trữ, pha, ngừng lấy nước sông...) và câu trả lời \"Tuần này lấy nước được không?\"; 204 khi không lập được")
    public ResponseEntity<FieldPlan> plan(@PathVariable Long id) {
        return fieldPlanService.plan(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    @Operation(summary = "Khai ruộng mới; đã đăng nhập thì tự theo dõi trạm gần ruộng cho tài khoản")
    public ResponseEntity<FieldDto> create(@Valid @RequestBody FieldRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fieldService.create(username(authentication), request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Sửa hồ sơ ruộng")
    public ResponseEntity<FieldDto> update(@PathVariable Long id, @Valid @RequestBody FieldRequest request,
                                           Authentication authentication) {
        return ResponseEntity.ok(fieldService.update(username(authentication), id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá ruộng (bỏ luôn theo dõi trạm của ruộng)")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        fieldService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Tên tài khoản, null khi là khách */
    private static String username(Authentication authentication) {
        return authentication == null || authentication instanceof AnonymousAuthenticationToken ? null : authentication.getName();
    }
}
