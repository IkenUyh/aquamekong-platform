package com.aquamekong.repository.user;

import com.aquamekong.entity.user.StationWatch;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StationWatchRepository extends JpaRepository<StationWatch, Long> {

    @EntityGraph(attributePaths = "station")
    List<StationWatch> findByUserIdOrderByCreatedAtAsc(Long userId);

    Optional<StationWatch> findByUserIdAndStationId(Long userId, Long stationId);

    long countByUserId(Long userId);

    @EntityGraph(attributePaths = {"station", "user"})
    List<StationWatch> findAllByOrderByStationIdAsc();
}
