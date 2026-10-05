package com.aquamekong.service.report;

import com.aquamekong.dto.report.ReportDtos.*;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import com.aquamekong.service.station.StationService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Báo cáo tổng hợp từ measurements. So sánh "kỳ hiện tại" [now - days, now)
 * với "kỳ trước" [now - 2*days, now - days).
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    public static final double SALINITY_THRESHOLD = 4.0;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final NamedParameterJdbcTemplate jdbc;
    private final MeasurementRepository measurementRepository;
    private final StationRepository stationRepository;

    public static int clampDays(int days) {
        return Math.max(1, Math.min(days, 90));
    }

    @Transactional(readOnly = true)
    public Overview overview(int days) {
        days = clampDays(days);
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime mid = now.minusDays(days);
        OffsetDateTime start = mid.minusDays(days);

        Map<String, PeriodValue> averages = new HashMap<>();
        jdbc.query("""
                SELECT metric_type,
                       AVG(value) FILTER (WHERE recorded_at >= :mid) AS cur,
                       AVG(value) FILTER (WHERE recorded_at <  :mid) AS prev
                FROM measurements
                WHERE metric_type IN ('salinity', 'water_level', 'flow_rate')
                  AND recorded_at >= :start AND recorded_at < :now
                GROUP BY metric_type
                """,
                new MapSqlParameterSource().addValue("start", start).addValue("mid", mid).addValue("now", now),
                rs -> {
                    averages.put(rs.getString("metric_type"),
                            new PeriodValue(round(rs.getObject("cur", Double.class)), round(rs.getObject("prev", Double.class))));
                });

        // Phân loại trạm theo độ mặn mới nhất (cùng ngưỡng với StationService.classifySalinity)
        Map<Long, Double> latestSalinity = measurementRepository.findLatestMeasurementPerStation().stream()
                .filter(m -> "salinity".equals(m.getMetricType()))
                .collect(Collectors.toMap(m -> m.getStation().getId(), Measurement::getValue, (a, b) -> a));
        long totalStations = stationRepository.count();
        Map<String, Long> byLevel = latestSalinity.values().stream()
                .collect(Collectors.groupingBy(StationService::classifySalinity, Collectors.counting()));
        List<LevelCount> distribution = List.of(
                new LevelCount("HIGH", "Cao (> 4‰)", byLevel.getOrDefault("HIGH", 0L)),
                new LevelCount("MEDIUM", "Trung bình (1 - 4‰)", byLevel.getOrDefault("MEDIUM", 0L)),
                new LevelCount("LOW", "Thấp (< 1‰)", byLevel.getOrDefault("LOW", 0L)),
                new LevelCount("UNKNOWN", "Chưa có dữ liệu", Math.max(0, totalStations - latestSalinity.size())));

        PeriodValue empty = new PeriodValue(null, null);
        return new Overview(
                days,
                averages.getOrDefault("salinity", empty),
                averages.getOrDefault("water_level", empty),
                averages.getOrDefault("flow_rate", empty),
                byLevel.getOrDefault("HIGH", 0L),
                totalStations,
                SALINITY_THRESHOLD,
                distribution);
    }

    /** Độ mặn trung bình toàn vùng theo ngày (giờ VN), kèm giá trị cùng vị trí ở kỳ trước. */
    @Transactional(readOnly = true)
    public List<TrendPoint> salinityTrend(int days) {
        days = clampDays(days);
        LocalDate today = LocalDate.now(ZONE);
        LocalDate firstDay = today.minusDays(days - 1L);
        LocalDate prevFirstDay = firstDay.minusDays(days);

        Map<LocalDate, Double> daily = new HashMap<>();
        jdbc.query("""
                SELECT (recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, AVG(value) AS avg
                FROM measurements
                WHERE metric_type = 'salinity'
                  AND recorded_at >= :from AND recorded_at < :to
                GROUP BY day
                """,
                new MapSqlParameterSource()
                        .addValue("from", prevFirstDay.atStartOfDay(ZONE).toOffsetDateTime())
                        .addValue("to", today.plusDays(1).atStartOfDay(ZONE).toOffsetDateTime()),
                rs -> {
                    daily.put(rs.getObject("day", LocalDate.class), round(rs.getDouble("avg")));
                });

        List<TrendPoint> points = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate day = firstDay.plusDays(i);
            points.add(new TrendPoint(day, daily.get(day), daily.get(day.minusDays(days))));
        }
        return points;
    }

    /** Các trạm có độ mặn trung bình cao nhất trong kỳ, kèm chênh lệch với kỳ trước. */
    @Transactional(readOnly = true)
    public List<TopStation> topStations(int days, int limit) {
        days = clampDays(days);
        limit = Math.max(1, Math.min(limit, 50));
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime mid = now.minusDays(days);

        List<TopStation> rows = jdbc.query("""
                SELECT s.id, s.name, s.province,
                       AVG(m.value) FILTER (WHERE m.recorded_at >= :mid) AS cur,
                       AVG(m.value) FILTER (WHERE m.recorded_at <  :mid) AS prev
                FROM measurements m
                JOIN stations s ON s.id = m.station_id
                WHERE m.metric_type = 'salinity'
                  AND m.recorded_at >= :start AND m.recorded_at < :now
                GROUP BY s.id, s.name, s.province
                HAVING AVG(m.value) FILTER (WHERE m.recorded_at >= :mid) IS NOT NULL
                ORDER BY cur DESC
                LIMIT :limit
                """,
                new MapSqlParameterSource()
                        .addValue("start", mid.minusDays(days)).addValue("mid", mid).addValue("now", now)
                        .addValue("limit", limit),
                (rs, i) -> {
                    Double cur = round(rs.getObject("cur", Double.class));
                    Double prev = round(rs.getObject("prev", Double.class));
                    return new TopStation(i + 1, rs.getLong("id"), rs.getString("name"), rs.getString("province"),
                            cur, prev, cur != null && prev != null ? round(cur - prev) : null);
                });
        return rows;
    }

    private static Double round(Double v) {
        return v == null ? null : Math.round(v * 100.0) / 100.0;
    }
}
