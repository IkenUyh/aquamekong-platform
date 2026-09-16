package com.aquamekong.controller;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.service.RecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/recommendations")
@RequiredArgsConstructor
@Tag(name = "Recommendations", description = "Khuyến nghị vận hành AI")
public class RecommendationController {
    private final RecommendationService recommendationService;

    @GetMapping
    @Operation(summary = "Lấy danh sách khuyến nghị")
    public ResponseEntity<List<RecommendationDto>> getRecommendations() {
        return ResponseEntity.ok(recommendationService.getRecommendations());
    }
}
