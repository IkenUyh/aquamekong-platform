package com.aquamekong.service;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.service.field.ActionPlan;
import com.aquamekong.service.field.FieldPlanService;
import com.aquamekong.service.field.WaterPlan.Et0;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
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
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Khuyến nghị vận hành theo ngưỡng chung 4‰: trạm đang vượt (số đo mới nhất), và trạm chưa vượt nhưng dự báo
 * hoặc mức có thể lên tới (mô hình rủi ro) vượt trong 7 ngày tới, để kịp trữ nước ngọt trước khi mặn vào.
 * <p>
 * Người dùng đã đăng nhập và có ruộng: thay bằng việc cần làm của từng ruộng ({@link ActionPlan}, ngưỡng theo cây và
 * giai đoạn), "Ruộng sau nhà (lúa): Trữ đầy ao trước hết ngày 16/11". Không lập được kế hoạch cho ruộng nào thì vẫn là
 * khuyến nghị chung.
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
    private final FieldProfileRepository fieldRepository;
    private final FieldPlanService fieldPlanService;
    private final StationWatchService watchService;

    /** Trạm chưa vượt nhưng có thể vượt: ngày đầu tiên và mức cao nhất có thể lên tới */
    private record Risk(Station station, LocalDate firstDate, double peak) {
    }

    /** Khuyến nghị chung theo 4‰ (khách) */
    @Transactional(readOnly = true)
    public List<RecommendationDto> getRecommendations() {
        return general(Instant.now());
    }

    /** @param username tài khoản đang xem, null = khách */
    @Transactional(readOnly = true)
    public List<RecommendationDto> getRecommendations(String username) {
        Instant now = Instant.now();
        if (username != null) {
            List<RecommendationDto> personal = forFields(fieldRepository.findByUserUsernameOrderByCreatedAtAsc(username), now);
            if (!personal.isEmpty()) return personal;
        }
        return general(now);
    }

    /** Việc cần làm của từng ruộng, việc gấp trước (giữ thứ tự ruộng và ngày trong cùng mức) */
    List<RecommendationDto> forFields(List<FieldProfile> fields, Instant now) {
        if (fields.isEmpty()) return List.of();
        Map<Long, StationSnapshot> snapshots = new HashMap<>();
        Map<Integer, Et0> et0 = fieldPlanService.et0ByMonth();
        List<RecommendationDto> out = new ArrayList<>();
        for (FieldProfile field : fields) {
            FieldPlan plan = fieldPlanService.plan(field, id -> snapshots.computeIfAbsent(id, watchService::snapshot), et0, now)
                    .orElse(null);
            if (plan == null) continue;
            String prefix = field.getName() + " (" + field.getCrop().getName().toLowerCase(VI) + "): ";
            for (PlanAction a : plan.actions()) {
                out.add(RecommendationDto.builder()
                        .type(type(a.kind()))
                        .priority(a.priority())
                        .message(prefix + a.message())
                        .fieldId(field.getId())
                        .fieldName(field.getName())
                        .from(a.from())
                        .until(a.until())
                        .build());
            }
        }
        return out.stream().sorted(Comparator.comparingInt(r -> priorityRank(r.getPriority()))).toList();
    }

    private static String type(String kind) {
        return switch (kind) {
            case ActionPlan.STORE -> "WATER_STORAGE";
            case ActionPlan.TAKE_WATER -> "WATER_SAVING";
            case ActionPlan.STAGE_CHANGE -> "CROP_STAGE";
            default -> "IRRIGATION";
        };
    }

    private static int priorityRank(String priority) {
        return switch (priority == null ? "" : priority) {
            case "HIGH" -> 0;
            case "MEDIUM" -> 1;
            default -> 2;
        };
    }

    private List<RecommendationDto> general(Instant now) {
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
