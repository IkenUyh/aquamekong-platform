package com.aquamekong.repository;

import com.aquamekong.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findTop20ByOrderByCreatedAtDesc();
    List<Alert> findByStationIdOrderByCreatedAtDesc(Long stationId);
    List<Alert> findByIsResolvedFalseOrderByCreatedAtDesc();
    long countByIsResolvedFalse();
}
