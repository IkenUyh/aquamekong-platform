package com.aquamekong.service.report;

import com.aquamekong.dto.report.ReplayDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Phát lại lịch sử: độ mặn theo ngày của từng trạm và các cảnh báo lẽ ra đã được tạo
 * (vượt ngưỡng → mở, xuống dưới ngưỡng → đóng), tính lại từ measurements.
 */
@Service
@RequiredArgsConstructor
public class ReplayService {

    public static final int MAX_DAYS = 366;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final NamedParameterJdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public Bounds bounds() {
        return jdbc.queryForObject("""
                SELECT MIN(recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS min_date,
                       MAX(recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS max_date
                FROM measurements WHERE metric_type = 'salinity'
                """, new MapSqlParameterSource(),
                (rs, i) -> new Bounds(rs.getObject("min_date", LocalDate.class), rs.getObject("max_date", LocalDate.class)));
    }

    @Transactional(readOnly = true)
    public Replay replay(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("Ngày bắt đầu phải trước ngày kết thúc");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
            throw new IllegalArgumentException("Chỉ phát lại tối đa " + MAX_DAYS + " ngày mỗi lần");
        }

        // Ngưỡng của trạm = rule độ mặn đang bật thấp nhất (toán tử > hoặc >=), không có thì dùng ngưỡng chung
        List<Station> stations = jdbc.query("""
                SELECT s.id, s.code, s.name, ST_Y(s.location) AS lat, ST_X(s.location) AS lon,
                       (SELECT MIN(r.threshold) FROM alert_rules r
                         WHERE r.station_id = s.id AND r.is_active AND r.metric_type = 'salinity'
                           AND r.operator IN ('>', '>=')) AS threshold
                FROM stations s
                WHERE s.status = 'ACTIVE'
                ORDER BY s.name
                """, new MapSqlParameterSource(),
                (rs, i) -> {
                    Double threshold = rs.getObject("threshold", Double.class);
                    return new Station(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                            rs.getDouble("lat"), rs.getDouble("lon"),
                            threshold != null ? threshold : ReportService.SALINITY_THRESHOLD);
                });

        Map<Long, Map<LocalDate, Double>> daily = new HashMap<>();
        jdbc.query("""
                SELECT station_id, (recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, MAX(value) AS salinity
                FROM measurements
                WHERE metric_type = 'salinity' AND recorded_at >= :start AND recorded_at < :end
                GROUP BY station_id, day
                """,
                new MapSqlParameterSource()
                        .addValue("start", from.atStartOfDay(ZONE).toOffsetDateTime())
                        .addValue("end", to.plusDays(1).atStartOfDay(ZONE).toOffsetDateTime()),
                rs -> {
                    daily.computeIfAbsent(rs.getLong("station_id"), k -> new HashMap<>())
                            .put(rs.getObject("day", LocalDate.class), rs.getDouble("salinity"));
                });

        return new Replay(from, to, ReportService.SALINITY_THRESHOLD, stations, buildDays(stations, daily, from, to));
    }

    /**
     * Đi qua từng ngày như MeasurementPoller + AlertService: mỗi trạm tối đa 1 cảnh báo mở,
     * mở khi vượt ngưỡng, đóng khi số đo về dưới ngưỡng. Ngày không có số đo giữ nguyên trạng thái
     * (mất số đo không có nghĩa là hết mặn).
     */
    static List<Day> buildDays(List<Station> stations, Map<Long, Map<LocalDate, Double>> daily,
                               LocalDate from, LocalDate to) {
        boolean[] open = new boolean[stations.size()];
        int openCount = 0;
        List<Day> days = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            List<Double> values = new ArrayList<>(stations.size());
            List<Event> events = new ArrayList<>();
            int aboveCount = 0;
            for (int i = 0; i < stations.size(); i++) {
                Station station = stations.get(i);
                Double value = daily.getOrDefault(station.id(), Map.of()).get(date);
                values.add(value);
                if (value == null) continue;

                boolean above = value > station.threshold();
                if (above) aboveCount++;
                if (above != open[i]) {
                    events.add(new Event(station.id(), above ? EventType.OPENED : EventType.RESOLVED, value));
                    open[i] = above;
                    openCount += above ? 1 : -1;
                }
            }
            days.add(new Day(date, values, aboveCount, openCount, events));
        }
        return days;
    }
}
