package com.aquamekong.repository.device;

import com.aquamekong.entity.device.Sensor;
import com.aquamekong.entity.enums.SensorStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SensorRepository extends JpaRepository<Sensor, Long> {

    Optional<Sensor> findBySensorCode(String sensorCode);

    List<Sensor> findByDeviceId(Long deviceId);

    List<Sensor> findByMetricType(String metricType);

    List<Sensor> findByStatus(SensorStatus status);

    List<Sensor> findByDeviceIdAndStatus(Long deviceId, SensorStatus status);
}
