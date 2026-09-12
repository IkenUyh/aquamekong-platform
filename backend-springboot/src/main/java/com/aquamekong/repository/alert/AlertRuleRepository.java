package com.aquamekong.repository.alert;

import com.aquamekong.entity.alert.AlertRule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {

    List<AlertRule> findByStationId(Long stationId);

    List<AlertRule> findByMetricType(String metricType);

    List<AlertRule> findByIsActiveTrue();

    List<AlertRule> findByStationIdAndIsActiveTrue(Long stationId);

    List<AlertRule> findByStationIdAndMetricTypeAndIsActiveTrue(Long stationId, String metricType);
}
