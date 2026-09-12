package com.aquamekong.controller.device;

import com.aquamekong.dto.device.DeviceDto;
import com.aquamekong.service.device.DeviceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
@Tag(name = "Devices", description = "Quản lý thiết bị phần cứng / IoT gateway tại các trạm")
public class DeviceController {

    private final DeviceService deviceService;

    @GetMapping
    @Operation(summary = "Danh sách thiết bị", description = "Lấy tất cả thiết bị trong hệ thống")
    public ResponseEntity<List<DeviceDto>> getAllDevices() {
        return ResponseEntity.ok(deviceService.getAllDevices());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết thiết bị")
    public ResponseEntity<DeviceDto> getDeviceById(@PathVariable Long id) {
        return ResponseEntity.ok(deviceService.getDeviceById(id));
    }

    @GetMapping("/station/{stationId}")
    @Operation(summary = "Danh sách thiết bị theo trạm")
    public ResponseEntity<List<DeviceDto>> getDevicesByStationId(@PathVariable Long stationId) {
        return ResponseEntity.ok(deviceService.getDevicesByStationId(stationId));
    }

    @PostMapping
    @Operation(summary = "Thêm thiết bị mới")
    public ResponseEntity<DeviceDto> createDevice(@RequestBody DeviceDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(deviceService.createDevice(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật thông tin thiết bị")
    public ResponseEntity<DeviceDto> updateDevice(@PathVariable Long id, @RequestBody DeviceDto dto) {
        return ResponseEntity.ok(deviceService.updateDevice(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa thiết bị")
    public ResponseEntity<Void> deleteDevice(@PathVariable Long id) {
        deviceService.deleteDevice(id);
        return ResponseEntity.noContent().build();
    }
}
