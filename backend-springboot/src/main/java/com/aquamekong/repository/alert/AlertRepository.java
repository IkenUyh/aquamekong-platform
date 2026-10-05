package com.aquamekong.repository.alert;

import com.aquamekong.entity.alert.Alert;
import com.aquamekong.entity.enums.AlertSeverity;
import com.aquamekong.entity.enums.AlertStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findAllByOrderByTriggeredAtDesc(Pageable pageable);

    List<Alert> findByStationIdOrderByTriggeredAtDesc(Long stationId);

    List<Alert> findByStatusOrderByTriggeredAtDesc(AlertStatus status);

    boolean existsByRuleIdAndStatusIn(Long ruleId, Collection<AlertStatus> statuses);

    List<Alert> findBySeverity(AlertSeverity severity);

    List<Alert> findByStationIdAndStatusOrderByTriggeredAtDesc(Long stationId, AlertStatus status);

    long countByStatus(AlertStatus status);
}
