package com.aquamekong.service;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import com.aquamekong.service.report.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Khuyến nghị vận hành theo ngưỡng chung 4‰: trạm đang vượt (số đo mới nhất), và trạm chưa vượt nhưng dự báo
 * hoặc mức có thể lên tới (mô hình rủi ro) vượt trong 7 ngày tới, để kịp trữ nước ngọt trước khi mặn vào.
 */
@Service
@RequiredArgsConstructor
public class RecommendationService {

    /** Dấu phẩy thập phân như phần còn lại của giao diện (5,0‰) */
    private static final Locale VI = Locale.forLanguageTag("vi-VN");
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");
    private static final double THRESHOLD = ReportService.SALINITY_THRESHOLD;
    /** Số đo cũ hơn mức này (trạm mất tín hiệu) không dùng để khuyến nghị, như theo dõi trạm */
    static final Duration MAX_MEASUREMENT_AGE = Duration.ofDays(3);
    static final int OUTLOOK_DAYS = 7;

    private final MeasurementRepository measurementRepository;
    private final SalinityForecastRepository forecastRepository;

    /** Trạm chưa vượt nhưng có thể vượt: ngày đầu tiên và mức cao nhất có thể lên tới */
    private record Risk(Station station, LocalDate firstDate, double peak) {
    }

    @Transactional(readOnly = true)
    public List<RecommendationDto> getRecommendations() {
        Instant now = Instant.now();
        LocalDate today = now.atZone(ZONE).toLocalDate();
        List<Measurement> latest = measurementRepository.findLatestMeasurementPerStation().stream()
                .filter(m -> "salinity".equalsIgnoreCase(m.getMetricType()) && m.getValue() != null && m.getStation() != null
                        && m.getRecordedAt() != null && !m.getRecordedAt().toInstant().isBefore(now.minus(MAX_MEASUREMENT_AGE)))
                .toList();
        Map<Long, List<SalinityForecast>> forecasts = forecastRepository
                .findLatestRunForecastsBetween(today, today.plusDays(OUTLOOK_DAYS)).stream()
                .collect(Collectors.groupingBy(f -> f.getStation().getId()));

        List<RecommendationDto> recommendations = new ArrayList<>();

        // Rule 1: trạm đang vượt 4‰ → hạn chế lấy nước, trạm mặn nhất trước
        latest.stream()
                .filter(m -> m.getValue() > THRESHOLD)
                .sorted(Comparator.comparing(Measurement::getValue).reversed())
                .forEach(m -> recommendations.add(RecommendationDto.builder()
                        .type("IRRIGATION")
                        .priority("HIGH")
                        .message(String.format(VI, "Hạn chế lấy nước tưới tại khu vực %s (%.1f‰)", m.getStation().getName(), m.getValue()))
                        .build()));

        // Rule 2: trạm chưa vượt nhưng có thể vượt trong 7 ngày → trữ nước ngọt trước ngày đó, ngày gần nhất trước
        latest.stream()
                .filter(m -> m.getValue() <= THRESHOLD)
                .map(m -> risk(m.getStation(), forecasts.getOrDefault(m.getStation().getId(), List.of())))
                .filter(r -> r != null)
                .sorted(Comparator.comparing(Risk::firstDate).thenComparing(Risk::peak, Comparator.reverseOrder()))
                .forEach(r -> recommendations.add(RecommendationDto.builder()
                        .type("WATER_STORAGE")
                        .priority("MEDIUM")
                        .message(String.format(VI, "Trữ nước ngọt trước ngày %s: khu vực %s có thể vượt %s‰ (tới %.1f‰)",
                                DAY.format(r.firstDate()), r.station().getName(), formatThreshold(), r.peak()))
                        .build()));

        if (recommendations.isEmpty()) {
            recommendations.add(RecommendationDto.builder()
                    .type("WATER_SAVING")
                    .priority("LOW")
                    .message("Độ mặn đang ở mức an toàn và chưa có nguy cơ vượt " + formatThreshold()
                            + "‰ trong 7 ngày tới. Có thể tiến hành lấy nước ngọt.")
                    .build());
        } else {
            recommendations.add(RecommendationDto.builder()
                    .type("DAM_CHECK")
                    .priority("MEDIUM")
                    .message("Khuyến nghị kiểm tra hệ thống cống ngăn mặn ở hạ lưu.")
                    .build());
        }
        return recommendations;
    }

    /** Ngày đầu tiên dự báo hoặc mức có thể lên tới vượt ngưỡng; null nếu không có */
    private static Risk risk(Station station, List<SalinityForecast> forecasts) {
        LocalDate first = null;
        double peak = 0;
        for (SalinityForecast f : forecasts) {
            double high = Math.max(f.getPredictedSalinity() != null ? f.getPredictedSalinity() : 0,
                    f.getRiskSalinity() != null ? f.getRiskSalinity() : 0);
            if (high <= THRESHOLD) continue;
            if (first == null || f.getForecastDate().isBefore(first)) first = f.getForecastDate();
            peak = Math.max(peak, high);
        }
        return first == null ? null : new Risk(station, first, peak);
    }

    private static String formatThreshold() {
        return String.format(VI, "%.0f", THRESHOLD);
    }
}
