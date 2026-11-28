package com.aquamekong.controller;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.service.RecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
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
    @Operation(summary = "Lấy danh sách khuyến nghị; đã đăng nhập và có ruộng thì theo từng ruộng")
    public ResponseEntity<List<RecommendationDto>> getRecommendations(Authentication authentication) {
        return ResponseEntity.ok(recommendationService.getRecommendations(username(authentication)));
    }

    /** Tên tài khoản, null khi là khách (như FieldProfileController) */
    private static String username(Authentication authentication) {
        return authentication == null || authentication instanceof AnonymousAuthenticationToken ? null : authentication.getName();
    }
}
