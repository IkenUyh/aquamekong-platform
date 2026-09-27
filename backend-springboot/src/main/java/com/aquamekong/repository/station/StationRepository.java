package com.aquamekong.repository.station;

import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.station.Station;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StationRepository extends JpaRepository<Station, Long> {

    Optional<Station> findByCode(String code);

    List<Station> findByStatus(StationStatus status);

    List<Station> findByProvince(String province);

    List<Station> findByRiverId(Long riverId);

    /**
     * Tìm các trạm trong bán kính (mét) từ tọa độ cho trước sử dụng PostGIS.
     */
    @Query(value = """
        SELECT s.* FROM stations s
        WHERE ST_DWithin(
            s.location::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :radiusMeters
        )
        ORDER BY ST_Distance(
            s.location::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )
        """, nativeQuery = true)
    List<Station> findNearbyStations(
            @Param("lng") double lng,
            @Param("lat") double lat,
            @Param("radiusMeters") double radiusMeters
    );
}
