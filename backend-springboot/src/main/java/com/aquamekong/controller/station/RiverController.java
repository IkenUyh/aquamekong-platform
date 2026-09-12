package com.aquamekong.controller.station;

import com.aquamekong.dto.station.RiverDto;
import com.aquamekong.service.station.RiverService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rivers")
@RequiredArgsConstructor
@Tag(name = "Rivers", description = "Quản lý hệ thống sông ngòi")
public class RiverController {

    private final RiverService riverService;

    @GetMapping
    @Operation(summary = "Danh sách sông", description = "Lấy tất cả danh sách các sông trong hệ thống")
    public ResponseEntity<List<RiverDto>> getAllRivers() {
        return ResponseEntity.ok(riverService.getAllRivers());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết sông", description = "Lấy thông tin chi tiết một sông theo ID")
    public ResponseEntity<RiverDto> getRiverById(@PathVariable Long id) {
        return ResponseEntity.ok(riverService.getRiverById(id));
    }

    @PostMapping
    @Operation(summary = "Tạo sông mới")
    public ResponseEntity<RiverDto> createRiver(@RequestBody RiverDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(riverService.createRiver(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật thông tin sông")
    public ResponseEntity<RiverDto> updateRiver(@PathVariable Long id, @RequestBody RiverDto dto) {
        return ResponseEntity.ok(riverService.updateRiver(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa sông")
    public ResponseEntity<Void> deleteRiver(@PathVariable Long id) {
        riverService.deleteRiver(id);
        return ResponseEntity.noContent().build();
    }
}
