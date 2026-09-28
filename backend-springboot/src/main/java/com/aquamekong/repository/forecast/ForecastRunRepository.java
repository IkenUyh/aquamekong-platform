package com.aquamekong.repository.forecast;

import com.aquamekong.entity.enums.ForecastRunStatus;
import com.aquamekong.entity.forecast.ForecastRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface ForecastRunRepository extends JpaRepository<ForecastRun, Long> {

    List<ForecastRun> findByModelVersion(String modelVersion);

    List<ForecastRun> findByStatus(ForecastRunStatus status);

    List<ForecastRun> findByRunAtBetweenOrderByRunAtDesc(OffsetDateTime from, OffsetDateTime to);
}
