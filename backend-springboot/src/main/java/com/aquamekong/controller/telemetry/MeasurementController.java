package com.aquamekong.controller.telemetry;

import com.aquamekong.dto.telemetry.MeasurementDto;
import com.aquamekong.dto.telemetry.TelemetryIngestDto;
import com.aquamekong.service.alert.AlertService;
import com.aquamekong.service.telemetry.MeasurementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/measurements")
@RequiredArgsConstructor
@Tag(name = "Telemetry & Measurements", description = "Tiếp nhận và truy vấn số liệu đo đạc quan trắc thủy văn")
public class MeasurementController {

    private final MeasurementService measurementService;
    private final AlertService alertService;

    @PostMapping("/ingest")
    @Operation(summary = "Tiếp nhận telemetry từ IoT Gateway", description = "Ghi nhận số liệu đo từ cảm biến và tự động đánh giá cảnh báo")
    public ResponseEntity<MeasurementDto> ingestTelemetry(@RequestBody TelemetryIngestDto ingestDto) {
        MeasurementDto measurement = measurementService.ingestTelemetry(ingestDto);
        alertService.evaluateMeasurement(measurement);
        return ResponseEntity.status(HttpStatus.CREATED).body(measurement);
    }

    @GetMapping("/latest")
    @Operation(summary = "Số liệu mới nhất mỗi trạm", description = "Lấy số liệu quan trắc mới nhất cho tất cả các trạm")
    public ResponseEntity<List<MeasurementDto>> getLatestPerStation() {
        return ResponseEntity.ok(measurementService.getLatestPerStation());
    }

    @GetMapping("/station/{stationId}")
    @Operation(summary = "Số liệu theo trạm")
    public ResponseEntity<List<MeasurementDto>> getByStationId(@PathVariable Long stationId) {
        return ResponseEntity.ok(measurementService.getByStationId(stationId));
    }

    @GetMapping("/station/{stationId}/latest")
    @Operation(summary = "Số liệu chỉ số cụ thể mới nhất theo trạm")
    public ResponseEntity<MeasurementDto> getLatestByStationAndMetric(
            @PathVariable Long stationId,
            @RequestParam String metricType) {
        return ResponseEntity.ok(measurementService.getLatestByStationAndMetric(stationId, metricType));
    }

    @GetMapping("/station/{stationId}/range")
    @Operation(summary = "Số liệu theo khoảng thời gian")
    public ResponseEntity<List<MeasurementDto>> getByStationAndTimeRange(
            @PathVariable Long stationId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        return ResponseEntity.ok(measurementService.getByStationAndTimeRange(stationId, from, to));
    }

    @GetMapping("/sensor/{sensorId}")
    @Operation(summary = "Số liệu theo cảm biến")
    public ResponseEntity<List<MeasurementDto>> getBySensorId(@PathVariable Long sensorId) {
        return ResponseEntity.ok(measurementService.getBySensorId(sensorId));
    }

    @PostMapping
    @Operation(summary = "Lưu số liệu đo mới")
    public ResponseEntity<MeasurementDto> saveMeasurement(@RequestBody MeasurementDto dto) {
        MeasurementDto saved = measurementService.saveMeasurement(dto);
        alertService.evaluateMeasurement(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
