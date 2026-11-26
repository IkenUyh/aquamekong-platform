package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.Exposure;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.service.field.SalinityExposure.Season;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Đọc độ mặn cao nhất mỗi ngày của trạm trong mùa của ruộng, rồi tính bằng {@link SalinityExposure}. */
@Service
@RequiredArgsConstructor
public class SalinityExposureService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FieldProfileRepository fieldRepository;
    private final NamedParameterJdbcTemplate jdbc;

    /** Rỗng khi ruộng không có trạm, không phải cây trồng, chưa gieo, hoặc cây chưa có ngưỡng nào */
    @Transactional(readOnly = true)
    public Optional<Exposure> exposure(Long fieldId) {
        FieldProfile field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy ruộng: " + fieldId));
        if (field.getStation() == null) return Optional.empty();
        LocalDate today = LocalDate.now(ZONE);
        Season season = SalinityExposure.season(field.getCrop(), field.getPlantedOn(), field.getVarietyDays(), today);
        if (season == null) return Optional.empty();
        LocalDate through = today.isBefore(season.end()) ? today : season.end();
        Map<LocalDate, Double> daily = dailyMax(field.getStation().getId(), season.start(), through);
        return Optional.of(SalinityExposure.compute(field.getCrop(), season, field.getPlantedOn(),
                field.getVarietyDays(), daily, today));
    }

    private Map<LocalDate, Double> dailyMax(Long stationId, LocalDate from, LocalDate through) {
        String sql = """
            SELECT (recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, MAX(value) AS value
            FROM measurements
            WHERE station_id = :stationId AND metric_type = 'salinity'
              AND recorded_at >= :since AND recorded_at < :until
            GROUP BY 1
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("stationId", stationId)
                .addValue("since", from.atStartOfDay(ZONE).toOffsetDateTime())
                .addValue("until", through.plusDays(1).atStartOfDay(ZONE).toOffsetDateTime());
        Map<LocalDate, Double> daily = new HashMap<>();
        jdbc.query(sql, params, rs -> {
            daily.put(rs.getObject("day", LocalDate.class), rs.getDouble("value"));
        });
        return daily;
    }
}
