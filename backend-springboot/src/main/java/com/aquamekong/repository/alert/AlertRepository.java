package com.aquamekong.repository.alert;

import com.aquamekong.entity.alert.Alert;
import com.aquamekong.entity.enums.AlertSeverity;
import com.aquamekong.entity.enums.AlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByStationIdOrderByTriggeredAtDesc(Long stationId);

    List<Alert> findByStatus(AlertStatus status);

    List<Alert> findBySeverity(AlertSeverity severity);

    List<Alert> findByStationIdAndStatusOrderByTriggeredAtDesc(Long stationId, AlertStatus status);

    long countByStatus(AlertStatus status);
}
