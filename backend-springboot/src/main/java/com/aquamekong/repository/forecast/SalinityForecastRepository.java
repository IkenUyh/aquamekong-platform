package com.aquamekong.repository.forecast;

import com.aquamekong.entity.forecast.SalinityForecast;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface SalinityForecastRepository extends JpaRepository<SalinityForecast, Long> {

    List<SalinityForecast> findByStationIdOrderByForecastDateAsc(Long stationId);

    List<SalinityForecast> findByRunId(Long runId);

    List<SalinityForecast> findByStationIdAndRunModelVersionOrderByForecastDateAsc(
            Long stationId, String modelVersion
    );

    List<SalinityForecast> findByStationIdAndForecastDateBetween(
            Long stationId, LocalDate from, LocalDate to
    );
}
