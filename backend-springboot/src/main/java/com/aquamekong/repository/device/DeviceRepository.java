package com.aquamekong.repository.device;

import com.aquamekong.entity.device.Device;
import com.aquamekong.entity.enums.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceRepository extends JpaRepository<Device, Long> {

    Optional<Device> findByDeviceCode(String deviceCode);

    List<Device> findByStationId(Long stationId);

    List<Device> findByStatus(DeviceStatus status);

    List<Device> findByStationIdAndStatus(Long stationId, DeviceStatus status);
}
