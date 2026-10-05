package com.aquamekong.repository.telemetry;

import com.aquamekong.entity.enums.QualityStatus;
import com.aquamekong.entity.telemetry.Measurement;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface MeasurementRepository extends JpaRepository<Measurement, Long> {

    List<Measurement> findByStationIdOrderByRecordedAtDesc(Long stationId, Pageable pageable);

    List<Measurement> findBySensorIdOrderByRecordedAtDesc(Long sensorId, Pageable pageable);

    List<Measurement> findByStationIdAndMetricTypeOrderByRecordedAtDesc(Long stationId, String metricType);

    List<Measurement> findByStationIdAndMetricTypeOrderByRecordedAtDesc(Long stationId, String metricType, Pageable pageable);

    List<Measurement> findByStationIdAndMetricTypeAndRecordedAtBetweenOrderByRecordedAtDesc(
            Long stationId, String metricType, OffsetDateTime from, OffsetDateTime to, Pageable pageable
    );

    List<Measurement> findByStationIdAndRecordedAtBetweenOrderByRecordedAtDesc(
            Long stationId, OffsetDateTime from, OffsetDateTime to, Pageable pageable
    );

    List<Measurement> findByQualityStatus(QualityStatus qualityStatus);

    List<Measurement> findByIdGreaterThanOrderByIdAsc(Long id, Pageable pageable);

    @Query("SELECT COALESCE(MAX(m.id), 0) FROM Measurement m")
    Long findMaxId();

    /**
     * Số liệu mới nhất của từng chỉ số (salinity, water_level, ...) tại mỗi trạm.
     * Các cặp (trạm, chỉ số) lấy từ sensors; LATERAL + LIMIT 1 dùng index
     * (station_id, metric_type, recorded_at DESC) thay vì quét toàn bộ measurements.
     */
    @Query(value = """
        SELECT m.*
        FROM (SELECT DISTINCT d.station_id, se.metric_type
              FROM sensors se JOIN devices d ON d.id = se.device_id) k
        CROSS JOIN LATERAL (
            SELECT * FROM measurements
            WHERE station_id = k.station_id AND metric_type = k.metric_type
            ORDER BY recorded_at DESC
            LIMIT 1
        ) m
        """, nativeQuery = true)
    List<Measurement> findLatestMeasurementPerStation();

    /**
     * Số liệu mới nhất của từng chỉ số tại 1 trạm.
     */
    @Query(value = """
        SELECT m.*
        FROM (SELECT DISTINCT se.metric_type
              FROM sensors se JOIN devices d ON d.id = se.device_id
              WHERE d.station_id = :stationId) k
        CROSS JOIN LATERAL (
            SELECT * FROM measurements
            WHERE station_id = :stationId AND metric_type = k.metric_type
            ORDER BY recorded_at DESC
            LIMIT 1
        ) m
        """, nativeQuery = true)
    List<Measurement> findLatestPerMetricByStationId(@Param("stationId") Long stationId);

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
