package com.aquamekong.service.device;

import com.aquamekong.dto.device.SensorDto;
import com.aquamekong.entity.device.Device;
import com.aquamekong.entity.device.Sensor;
import com.aquamekong.entity.enums.SensorStatus;
import com.aquamekong.repository.device.DeviceRepository;
import com.aquamekong.repository.device.SensorRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SensorService {

    private final SensorRepository sensorRepository;
    private final DeviceRepository deviceRepository;

    @Transactional(readOnly = true)
    public List<SensorDto> getAllSensors() {
        return sensorRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SensorDto getSensorById(Long id) {
        Sensor sensor = sensorRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sensor not found: " + id));
        return toDto(sensor);
    }

    @Transactional(readOnly = true)
    public List<SensorDto> getSensorsByDeviceId(Long deviceId) {
        return sensorRepository.findByDeviceId(deviceId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public SensorDto createSensor(SensorDto dto) {
        Device device = deviceRepository.findById(dto.getDeviceId())
                .orElseThrow(() -> new EntityNotFoundException("Device not found: " + dto.getDeviceId()));

        Sensor sensor = Sensor.builder()
                .device(device)
                .sensorCode(dto.getSensorCode())
                .name(dto.getName())
                .metricType(dto.getMetricType())
                .unit(dto.getUnit())
                .calibrationDate(dto.getCalibrationDate())
                .status(dto.getStatus() != null ? dto.getStatus() : SensorStatus.ACTIVE)
                .build();

        Sensor saved = sensorRepository.save(sensor);
        return toDto(saved);
    }

    @Transactional
    public SensorDto updateSensor(Long id, SensorDto dto) {
        Sensor sensor = sensorRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sensor not found: " + id));

        if (dto.getName() != null) sensor.setName(dto.getName());
        if (dto.getMetricType() != null) sensor.setMetricType(dto.getMetricType());
        if (dto.getUnit() != null) sensor.setUnit(dto.getUnit());
        if (dto.getCalibrationDate() != null) sensor.setCalibrationDate(dto.getCalibrationDate());
        if (dto.getStatus() != null) sensor.setStatus(dto.getStatus());

        Sensor saved = sensorRepository.save(sensor);
        return toDto(saved);
    }

    @Transactional
    public void deleteSensor(Long id) {
        if (!sensorRepository.existsById(id)) {
            throw new EntityNotFoundException("Sensor not found: " + id);
        }
        sensorRepository.deleteById(id);
    }

    private SensorDto toDto(Sensor sensor) {
        return SensorDto.builder()
                .id(sensor.getId())
                .deviceId(sensor.getDevice().getId())
                .deviceCode(sensor.getDevice().getDeviceCode())
                .sensorCode(sensor.getSensorCode())
                .name(sensor.getName())
                .metricType(sensor.getMetricType())
                .unit(sensor.getUnit())
                .calibrationDate(sensor.getCalibrationDate())
                .status(sensor.getStatus())
                .createdAt(sensor.getCreatedAt())
                .updatedAt(sensor.getUpdatedAt())
                .build();
    }
}
