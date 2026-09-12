package com.aquamekong.repository.telemetry;

import com.aquamekong.entity.enums.QualityStatus;
import com.aquamekong.entity.telemetry.Measurement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface MeasurementRepository extends JpaRepository<Measurement, Long> {

    List<Measurement> findByStationIdOrderByRecordedAtDesc(Long stationId);

    List<Measurement> findBySensorIdOrderByRecordedAtDesc(Long sensorId);

    List<Measurement> findByStationIdAndMetricTypeOrderByRecordedAtDesc(Long stationId, String metricType);

    List<Measurement> findByStationIdAndRecordedAtBetweenOrderByRecordedAtDesc(
            Long stationId, OffsetDateTime from, OffsetDateTime to
    );

    List<Measurement> findByQualityStatus(QualityStatus qualityStatus);

    /**
     * Lấy số liệu đo đạc mới nhất cho mỗi trạm (PostgreSQL DISTINCT ON).
     */
    @Query(value = """
        SELECT DISTINCT ON (m.station_id) m.*
        FROM measurements m
        ORDER BY m.station_id, m.recorded_at DESC
        """, nativeQuery = true)
    List<Measurement> findLatestMeasurementPerStation();

    /**
     * Lấy số liệu mới nhất của 1 chỉ số cụ thể tại 1 trạm.
     */
    @Query(value = """
        SELECT * FROM measurements
        WHERE station_id = :stationId AND metric_type = :metricType
        ORDER BY recorded_at DESC
        LIMIT 1
        """, nativeQuery = true)
    Measurement findLatestByStationIdAndMetricType(
            @Param("stationId") Long stationId,
            @Param("metricType") String metricType
    );
}
