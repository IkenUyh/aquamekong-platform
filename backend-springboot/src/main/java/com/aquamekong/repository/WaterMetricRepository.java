package com.aquamekong.repository;

import com.aquamekong.entity.WaterMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface WaterMetricRepository extends JpaRepository<WaterMetric, Long> {

    /**
     * Lịch sử metrics của 1 trạm, sắp xếp theo thời gian giảm dần.
     */
    List<WaterMetric> findByStationIdOrderByRecordedAtDesc(Long stationId);

    /**
     * Lịch sử metrics trong khoảng thời gian.
     */
    List<WaterMetric> findByStationIdAndRecordedAtBetweenOrderByRecordedAtDesc(
            Long stationId, OffsetDateTime from, OffsetDateTime to
    );

    /**
     * Lấy metric mới nhất cho mỗi trạm (dùng DISTINCT ON của PostgreSQL).
     */
    @Query(value = """
        SELECT DISTINCT ON (wm.station_id) wm.*
        FROM water_metrics wm
        ORDER BY wm.station_id, wm.recorded_at DESC
        """, nativeQuery = true)
    List<WaterMetric> findLatestMetricPerStation();

    /**
     * Lấy metric mới nhất của 1 trạm cụ thể.
     */
    @Query(value = """
        SELECT * FROM water_metrics
        WHERE station_id = :stationId
        ORDER BY recorded_at DESC
        LIMIT 1
        """, nativeQuery = true)
    WaterMetric findLatestByStationId(@Param("stationId") Long stationId);
}
