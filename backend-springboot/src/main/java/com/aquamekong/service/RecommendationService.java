package com.aquamekong.service;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    /** Dấu phẩy thập phân như phần còn lại của giao diện (5,0‰) */
    private static final Locale VI = Locale.forLanguageTag("vi-VN");

    private final MeasurementRepository measurementRepository;

    public List<RecommendationDto> getRecommendations() {
        List<RecommendationDto> recommendations = new ArrayList<>();

        // Rule 1: Nếu có trạm salinity > 4‰ → khuyến nghị hạn chế tưới tiêu
        List<Measurement> latestMetrics = measurementRepository.findLatestMeasurementPerStation();
        for (Measurement m : latestMetrics) {
            if ("SALINITY".equalsIgnoreCase(m.getMetricType()) && m.getValue() != null && m.getValue() > 4.0) {
                String stationName = m.getStation() != null ? m.getStation().getName() : ("Trạm " + (m.getStation() != null ? m.getStation().getId() : ""));
                recommendations.add(RecommendationDto.builder()
                    .type("IRRIGATION")
                    .priority("HIGH")
                    .message(String.format(VI, "Hạn chế lấy nước tưới tại khu vực %s (%.1f‰)",
                        stationName, m.getValue()))
                    .icon("🚫")
                    .build());
            }
        }

        // Rule 2: Cảnh báo chung nếu không có rule 1
        if (recommendations.isEmpty()) {
            recommendations.add(RecommendationDto.builder()
                .type("WATER_SAVING")
                .priority("LOW")
                .message("Độ mặn đang ở mức an toàn. Có thể tiến hành lấy nước ngọt.")
                .icon("✅")
                .build());
        } else {
             recommendations.add(RecommendationDto.builder()
                .type("DAM_CHECK")
                .priority("MEDIUM")
                .message("Khuyến nghị kiểm tra hệ thống cống ngăn mặn ở hạ lưu.")
                .icon("🔧")
                .build());
        }

        return recommendations;
    }
}
