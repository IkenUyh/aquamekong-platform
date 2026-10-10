package com.aquamekong.service.forecast;

import com.aquamekong.client.MlServiceClient;
import com.aquamekong.dto.forecast.VerificationPointDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * Dự báo đúng tới đâu. Hai nguồn: backtest của ML service (chạy lại mô hình trên số đo quá khứ, có kết quả ngay)
 * và dự báo đã lưu hằng ngày đặt cạnh số đo thật về sau (tích dần, đo đúng thứ người dùng đã thấy).
 */
@Service
@RequiredArgsConstructor
public class ForecastAccuracyService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final MlServiceClient mlServiceClient;
    private final NamedParameterJdbcTemplate jdbc;

    public Map<String, Object> accuracy(int days) {
        return mlServiceClient.accuracy(Math.max(30, Math.min(days, 365)));
    }

    /**
     * Dự báo đã lưu của trạm trong `days` ngày qua, mỗi ngày chạy lấy lượt mới nhất (job 07:30 hoặc người dùng
     * bấm chạy lại), ghép với độ mặn cao nhất đo được của ngày được dự báo. Ngày chưa có số đo thì chưa có trong kết quả;
     * ngày dự báo không sau ngày chạy (ST-GNN với dữ liệu cũ) bị bỏ.
     */
    public List<VerificationPointDto> verification(Long stationId, int days) {
        OffsetDateTime since = LocalDate.now(ZONE).minusDays(Math.max(1, Math.min(days, 90))).atStartOfDay(ZONE).toOffsetDateTime();
        String sql = """
            WITH runs AS (
                SELECT DISTINCT ON ((r.run_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                       r.id, (r.run_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS issued_on, r.model_version
                FROM forecast_runs r
                WHERE r.run_at >= :since
                  AND EXISTS (SELECT 1 FROM salinity_forecasts f WHERE f.run_id = r.id AND f.station_id = :stationId)
                ORDER BY (r.run_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, r.run_at DESC
            ), actual AS (
                SELECT (recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, MAX(value) AS value
                FROM measurements
                WHERE station_id = :stationId AND metric_type = 'salinity' AND recorded_at >= :since
                GROUP BY 1
            )
            SELECT f.forecast_date, runs.issued_on, f.forecast_date - runs.issued_on AS lead_days,
                   f.predicted_salinity, a.value AS actual, runs.model_version
            FROM runs
            JOIN salinity_forecasts f ON f.run_id = runs.id AND f.station_id = :stationId
            JOIN actual a ON a.day = f.forecast_date
            -- ST-GNN dự báo theo ngày cuối của dữ liệu của nó, có thể trước ngày chạy: không phải dự báo
            WHERE f.predicted_salinity IS NOT NULL AND f.forecast_date > runs.issued_on
            ORDER BY f.forecast_date, lead_days
            """;
        return jdbc.query(sql, new MapSqlParameterSource().addValue("stationId", stationId).addValue("since", since),
                (rs, i) -> new VerificationPointDto(
                        rs.getObject("forecast_date", LocalDate.class),
                        rs.getObject("issued_on", LocalDate.class),
                        rs.getInt("lead_days"),
                        rs.getDouble("predicted_salinity"),
                        rs.getDouble("actual"),
                        rs.getString("model_version")));
    }
}
