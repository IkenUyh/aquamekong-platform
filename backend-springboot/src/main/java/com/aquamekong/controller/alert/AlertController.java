package com.aquamekong.controller.alert;

import com.aquamekong.dto.alert.AlertDto;
import com.aquamekong.dto.alert.AlertRuleDto;
import com.aquamekong.entity.enums.AlertStatus;
import com.aquamekong.service.alert.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@Tag(name = "Alerts & Rules", description = "Quản lý hệ thống cảnh báo và luật cảnh báo ngưỡng")
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    @Operation(summary = "Danh sách tất cả cảnh báo")
    public ResponseEntity<List<AlertDto>> getAllAlerts() {
        return ResponseEntity.ok(alertService.getAllAlerts());
    }

    @GetMapping("/station/{stationId}")
    @Operation(summary = "Danh sách cảnh báo theo trạm")
    public ResponseEntity<List<AlertDto>> getAlertsByStationId(@PathVariable Long stationId) {
        return ResponseEntity.ok(alertService.getAlertsByStationId(stationId));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Danh sách cảnh báo theo trạng thái (ACTIVE, ACKNOWLEDGED, RESOLVED)")
    public ResponseEntity<List<AlertDto>> getAlertsByStatus(@PathVariable AlertStatus status) {
        return ResponseEntity.ok(alertService.getAlertsByStatus(status));
    }

    @PutMapping("/{alertId}/status")
    @Operation(summary = "Cập nhật trạng thái cảnh báo")
    public ResponseEntity<AlertDto> updateAlertStatus(
            @PathVariable Long alertId,
            @RequestParam AlertStatus status) {
        return ResponseEntity.ok(alertService.updateAlertStatus(alertId, status));
    }

    @GetMapping("/rules")
    @Operation(summary = "Danh sách luật cảnh báo")
    public ResponseEntity<List<AlertRuleDto>> getAllRules() {
        return ResponseEntity.ok(alertService.getAllRules());
    }

    @GetMapping("/rules/station/{stationId}")
    @Operation(summary = "Danh sách luật cảnh báo theo trạm")
    public ResponseEntity<List<AlertRuleDto>> getRulesByStationId(@PathVariable Long stationId) {
        return ResponseEntity.ok(alertService.getRulesByStationId(stationId));
    }

    @PostMapping("/rules")
    @Operation(summary = "Tạo hoặc cập nhật luật cảnh báo")
    public ResponseEntity<AlertRuleDto> saveRule(@RequestBody AlertRuleDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(alertService.saveRule(dto));
    }

    @DeleteMapping("/rules/{ruleId}")
    @Operation(summary = "Xóa luật cảnh báo")
    public ResponseEntity<Void> deleteRule(@PathVariable Long ruleId) {
        alertService.deleteRule(ruleId);
        return ResponseEntity.noContent().build();
    }
}
