package com.aquamekong.repository;

import com.aquamekong.entity.SalinityForecast;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalinityForecastRepository extends JpaRepository<SalinityForecast, Long> {

    List<SalinityForecast> findByStationIdOrderByForecastDateAsc(Long stationId);

    List<SalinityForecast> findByStationIdAndModelVersionOrderByForecastDateAsc(
            Long stationId, String modelVersion
    );
}
