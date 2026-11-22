package com.aquamekong.controller.crop;

import com.aquamekong.dto.crop.CropDtos.CropDto;
import com.aquamekong.service.crop.CropService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/crops")
@RequiredArgsConstructor
@Tag(name = "Crops", description = "Cây trồng, giai đoạn và ngưỡng mặn kèm nguồn")
public class CropController {

    private final CropService cropService;

    @GetMapping
    @Operation(summary = "Danh sách cây trồng / mục đích dùng nước",
            description = "Mỗi mục có các giai đoạn với ngưỡng cảnh báo theo khuyến cáo Việt Nam, đường giảm năng suất FAO 29 (nếu có) và nguồn của từng số")
    public ResponseEntity<List<CropDto>> list() {
        return ResponseEntity.ok(cropService.list());
    }
}
