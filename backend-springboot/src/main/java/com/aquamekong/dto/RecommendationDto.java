package com.aquamekong.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDate;

/** Một khuyến nghị. Khuyến nghị theo ruộng (người dùng đã đăng nhập và có ruộng) có thêm ruộng và khoảng ngày. */
@Data @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RecommendationDto {
    private String type;       // "IRRIGATION", "WATER_STORAGE", "WATER_SAVING", "DAM_CHECK", "CROP_STAGE"
    private String priority;   // "HIGH", "MEDIUM", "LOW"
    private String message;
    /** Ruộng của khuyến nghị, null với khuyến nghị chung theo 4‰ */
    private Long fieldId;
    private String fieldName;
    private LocalDate from;
    private LocalDate until;
}
