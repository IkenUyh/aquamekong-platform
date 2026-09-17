package com.aquamekong.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrendDataDto {
    private String date; // To match the frontend chart key 'date'
    private Double current; // 'current' key in frontend
    private Double prev; // 'prev' key in frontend
}
