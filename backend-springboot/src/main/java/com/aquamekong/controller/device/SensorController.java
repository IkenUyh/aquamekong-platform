package com.aquamekong.controller.device;

import com.aquamekong.dto.device.SensorDto;
import com.aquamekong.service.device.SensorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/sensors")
@RequiredArgsConstructor
@Tag(name = "Sensors", description = "Quản lý cảm biến đo đạc kết nối với thiết bị")
public class SensorController {

    private final SensorService sensorService;

    @GetMapping
    @Operation(summary = "Danh sách cảm biến")
    public ResponseEntity<List<SensorDto>> getAllSensors() {
        return ResponseEntity.ok(sensorService.getAllSensors());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết cảm biến")
    public ResponseEntity<SensorDto> getSensorById(@PathVariable Long id) {
        return ResponseEntity.ok(sensorService.getSensorById(id));
    }

    @GetMapping("/device/{deviceId}")
    @Operation(summary = "Danh sách cảm biến theo thiết bị")
    public ResponseEntity<List<SensorDto>> getSensorsByDeviceId(@PathVariable Long deviceId) {
        return ResponseEntity.ok(sensorService.getSensorsByDeviceId(deviceId));
    }

    @PostMapping
    @Operation(summary = "Thêm cảm biến mới")
    public ResponseEntity<SensorDto> createSensor(@RequestBody SensorDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sensorService.createSensor(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật cảm biến")
    public ResponseEntity<SensorDto> updateSensor(@PathVariable Long id, @RequestBody SensorDto dto) {
        return ResponseEntity.ok(sensorService.updateSensor(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa cảm biến")
    public ResponseEntity<Void> deleteSensor(@PathVariable Long id) {
        sensorService.deleteSensor(id);
        return ResponseEntity.noContent().build();
    }
}
