package com.aquamekong.repository.forecast;

import com.aquamekong.entity.forecast.SalinityForecast;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface SalinityForecastRepository extends JpaRepository<SalinityForecast, Long> {

    List<SalinityForecast> findByStationIdOrderByForecastDateAsc(Long stationId);

    List<SalinityForecast> findByRunId(Long runId);

    /**
     * Kết quả dự báo của lượt chạy mới nhất cho trạm (tránh trùng ngày giữa nhiều lượt chạy).
     */
    @Query("""
        SELECT f FROM SalinityForecast f
        JOIN FETCH f.run
        JOIN FETCH f.station
        WHERE f.station.id = :stationId
          AND f.run.id = (SELECT MAX(f2.run.id) FROM SalinityForecast f2 WHERE f2.station.id = :stationId)
        ORDER BY f.forecastDate ASC
        """)
    List<SalinityForecast> findLatestRunByStationId(@Param("stationId") Long stationId);

    List<SalinityForecast> findByStationIdAndRunModelVersionOrderByForecastDateAsc(
            Long stationId, String modelVersion
    );

    List<SalinityForecast> findByStationIdAndForecastDateBetween(
            Long stationId, LocalDate from, LocalDate to
    );
}
