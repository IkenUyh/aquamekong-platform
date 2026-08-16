package com.aquamekong.controller;

import com.aquamekong.dto.GeoJsonResponse;
import com.aquamekong.dto.StationDto;
import com.aquamekong.service.StationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stations")
@RequiredArgsConstructor
@Tag(name = "Stations", description = "Quản lý trạm quan trắc thủy văn")
public class StationController {

    private final StationService stationService;

    @GetMapping
    @Operation(summary = "Lấy tất cả trạm", description = "Trả về GeoJSON FeatureCollection chứa tất cả trạm kèm metrics mới nhất")
    public ResponseEntity<GeoJsonResponse> getAllStations() {
        return ResponseEntity.ok(stationService.getAllStationsAsGeoJson());
    }

    @GetMapping("/list")
    @Operation(summary = "Danh sách trạm (JSON)", description = "Trả về danh sách trạm dạng JSON thường")
    public ResponseEntity<List<StationDto>> getAllStationsList() {
        return ResponseEntity.ok(stationService.getAllStations());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết trạm", description = "Lấy thông tin chi tiết 1 trạm theo ID")
    public ResponseEntity<StationDto> getStationById(@PathVariable Long id) {
        return ResponseEntity.ok(stationService.getStationById(id));
    }

    @PostMapping
    @Operation(summary = "Tạo trạm mới")
    public ResponseEntity<StationDto> createStation(@RequestBody StationDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(stationService.createStation(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật trạm")
    public ResponseEntity<StationDto> updateStation(@PathVariable Long id, @RequestBody StationDto dto) {
        return ResponseEntity.ok(stationService.updateStation(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa trạm")
    public ResponseEntity<Void> deleteStation(@PathVariable Long id) {
        stationService.deleteStation(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/nearby")
    @Operation(summary = "Tìm trạm lân cận", description = "Tìm trạm trong bán kính (km) từ tọa độ cho trước")
    public ResponseEntity<GeoJsonResponse> findNearbyStations(
            @RequestParam double lng,
            @RequestParam double lat,
            @RequestParam(defaultValue = "50") double radius) {
        return ResponseEntity.ok(stationService.findNearbyStations(lng, lat, radius));
    }
}
