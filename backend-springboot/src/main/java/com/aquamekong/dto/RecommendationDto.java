package com.aquamekong.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class RecommendationDto {
    private String type;       // "IRRIGATION", "WATER_SAVING", "DAM_CHECK"
    private String priority;   // "HIGH", "MEDIUM", "LOW"
    private String message;
    private String icon;
}
