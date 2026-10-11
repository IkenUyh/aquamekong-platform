package com.aquamekong.service.report;

import com.aquamekong.client.MlServiceClient;
import com.aquamekong.client.MlServiceClient.EarlyWarningEpisodes;
import com.aquamekong.client.MlServiceClient.Episode;
import com.aquamekong.dto.report.ReplayDtos.*;
import com.aquamekong.exception.MlServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 * (vượt ngưỡng → mở, xuống dưới ngưỡng → đóng), tính lại từ measurements. Trong các mùa khô đã chạy lại mô hình
 * rủi ro (ML service), thêm các cảnh báo sớm app lẽ ra đã gửi, theo đúng ngưỡng của từng trạm.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReplayService {

    public static final int MAX_DAYS = 366;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final EarlyWarningEpisodes NO_EARLY_WARNINGS = new EarlyWarningEpisodes(false, List.of(), Map.of());

    private final NamedParameterJdbcTemplate jdbc;
    private final MlServiceClient mlServiceClient;

    @Transactional(readOnly = true)
    public Bounds bounds() {
        return jdbc.queryForObject("""
                SELECT MIN(recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS min_date,
                       MAX(recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS max_date
                FROM measurements WHERE metric_type = 'salinity'
                """, new MapSqlParameterSource(),
                (rs, i) -> new Bounds(rs.getObject("min_date", LocalDate.class), rs.getObject("max_date", LocalDate.class)));
    }

    /** Không chạy trong transaction: lời gọi ML service không giữ connection DB */
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

        EarlyWarningEpisodes episodes = earlyWarnings(from, to, stations);
        List<Day> days = buildDays(stations, daily, from, to, episodes.stations());
        return new Replay(from, to, ReportService.SALINITY_THRESHOLD, stations, days, summarize(days, daily, episodes));
    }

    private EarlyWarningEpisodes earlyWarnings(LocalDate from, LocalDate to, List<Station> stations) {
        if (stations.isEmpty()) return NO_EARLY_WARNINGS;
        Map<Long, Double> thresholds = new LinkedHashMap<>();
        stations.forEach(s -> thresholds.put(s.id(), s.threshold()));
        try {
            EarlyWarningEpisodes result = mlServiceClient.earlyWarningEpisodes(from, to, thresholds);
            return result.stations() == null ? NO_EARLY_WARNINGS : result;
        } catch (MlServiceException e) {
            // Phát lại vẫn chạy, chỉ thiếu cảnh báo sớm
            log.warn("Phát lại không có cảnh báo sớm: {}", e.getMessage());
            return NO_EARLY_WARNINGS;
        }
    }

    static List<Day> buildDays(List<Station> stations, Map<Long, Map<LocalDate, Double>> daily,
                               LocalDate from, LocalDate to) {
        return buildDays(stations, daily, from, to, Map.of());
    }

    /**
     * Đi qua từng ngày như MeasurementPoller + AlertService: mỗi trạm tối đa 1 cảnh báo mở,
     * mở khi vượt ngưỡng, đóng khi số đo về dưới ngưỡng. Ngày không có số đo giữ nguyên trạng thái
     * (mất số đo không có nghĩa là hết mặn). Cảnh báo sớm hiện vào sáng ngày app gửi; lần vượt ngưỡng
     * đang có cảnh báo sớm từ hôm trước ghi số ngày đã báo trước.
     */
    static List<Day> buildDays(List<Station> stations, Map<Long, Map<LocalDate, Double>> daily,
                               LocalDate from, LocalDate to, Map<Long, List<Episode>> episodes) {
        boolean[] open = new boolean[stations.size()];
        int openCount = 0;
        List<Day> days = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            List<Double> values = new ArrayList<>(stations.size());
            List<Event> events = new ArrayList<>();
            int aboveCount = 0;
            int warningCount = 0;
            for (int i = 0; i < stations.size(); i++) {
                Station station = stations.get(i);
                List<Episode> warnings = episodes.getOrDefault(station.id(), List.of());
                for (Episode w : warnings) {
                    if (w.start().equals(date)) {
                        events.add(new Event(station.id(), EventType.WARNED, w.peak() != null ? w.peak() : 0,
                                null, w.firstRiskDate(), w.outcome(), w.end()));
                    }
                }
                Episode active = activeOn(warnings, date);
                if (active != null) warningCount++;

                Double value = daily.getOrDefault(station.id(), Map.of()).get(date);
                values.add(value);
                if (value == null) continue;

                boolean above = value > station.threshold();
                if (above) aboveCount++;
                if (above != open[i]) {
                    Integer warnedDaysAhead = above && active != null && active.start().isBefore(date)
                            ? (int) ChronoUnit.DAYS.between(active.start(), date) : null;
                    events.add(new Event(station.id(), above ? EventType.OPENED : EventType.RESOLVED, value,
                            warnedDaysAhead, null, null, null));
                    open[i] = above;
                    openCount += above ? 1 : -1;
                }
            }
            days.add(new Day(date, values, aboveCount, openCount, warningCount, events));
        }
        return days;
    }

    /** Cảnh báo sớm đang hiệu lực sáng `date`: từ sáng gửi tới trước sáng rõ kết quả */
    private static Episode activeOn(List<Episode> warnings, LocalDate date) {
        for (Episode w : warnings) {
            if (!w.start().isAfter(date) && (w.end() == null || w.end().isAfter(date))) return w;
        }
        return null;
    }

    /** Tổng hợp cảnh báo sớm của giai đoạn, chỉ trên các ngày thuộc mùa khô đã chạy lại */
    static EarlyWarning summarize(List<Day> days, Map<Long, Map<LocalDate, Double>> daily, EarlyWarningEpisodes episodes) {
        List<Season> seasons = episodes.seasons() == null ? List.of() : episodes.seasons().stream()
                .map(s -> new Season(s.label(), s.from(), s.to())).toList();
        if (!episodes.available() || seasons.isEmpty()) {
            return new EarlyWarning(episodes.available(), seasons, 0, 0, null, 0, 0, 0);
        }
        Map<Long, LocalDate> firstReading = new HashMap<>();
        daily.forEach((id, values) -> values.keySet().stream().min(LocalDate::compareTo).ifPresent(d -> firstReading.put(id, d)));

        int opened = 0, warnings = 0, hits = 0, misses = 0;
        List<Integer> leads = new ArrayList<>();
        for (Day day : days) {
            if (seasons.stream().noneMatch(s -> !day.date().isBefore(s.from()) && !day.date().isAfter(s.to()))) continue;
            for (Event e : day.events()) {
                if (e.type() == EventType.WARNED) {
                    warnings++;
                    if ("HIT".equals(e.outcome())) hits++;
                    if ("MISS".equals(e.outcome())) misses++;
                } else if (e.type() == EventType.OPENED && firstReading.get(e.stationId()).isBefore(day.date())) {
                    // Ngày đầu có số đo của giai đoạn: không biết trạm vừa vượt hay đã vượt từ trước
                    opened++;
                    if (e.warnedDaysAhead() != null) leads.add(e.warnedDaysAhead());
                }
            }
        }
        Collections.sort(leads);
        Double median = leads.isEmpty() ? null : leads.size() % 2 == 1 ? leads.get(leads.size() / 2)
                : (leads.get(leads.size() / 2 - 1) + leads.get(leads.size() / 2)) / 2.0;
        return new EarlyWarning(true, seasons, opened, leads.size(), median, warnings, hits, misses);
    }
}
