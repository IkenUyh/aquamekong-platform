package com.aquamekong.service.device;

import com.aquamekong.dto.device.DeviceDto;
import com.aquamekong.entity.device.Device;
import com.aquamekong.entity.enums.DeviceStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.device.DeviceRepository;
import com.aquamekong.repository.station.StationRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final StationRepository stationRepository;

    @Transactional(readOnly = true)
    public List<DeviceDto> getAllDevices() {
        return deviceRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DeviceDto getDeviceById(Long id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Device not found: " + id));
        return toDto(device);
    }

    @Transactional(readOnly = true)
    public List<DeviceDto> getDevicesByStationId(Long stationId) {
        return deviceRepository.findByStationId(stationId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public DeviceDto createDevice(DeviceDto dto) {
        Station station = stationRepository.findById(dto.getStationId())
                .orElseThrow(() -> new EntityNotFoundException("Station not found: " + dto.getStationId()));

        Device device = Device.builder()
                .station(station)
                .deviceCode(dto.getDeviceCode())
                .name(dto.getName())
                .deviceType(dto.getDeviceType())
                .manufacturer(dto.getManufacturer())
                .model(dto.getModel())
                .serialNumber(dto.getSerialNumber())
                .status(dto.getStatus() != null ? dto.getStatus() : DeviceStatus.ONLINE)
                .installedAt(dto.getInstalledAt())
                .lastSeenAt(dto.getLastSeenAt())
                .build();

        Device saved = deviceRepository.save(device);
        return toDto(saved);
    }

    @Transactional
    public DeviceDto updateDevice(Long id, DeviceDto dto) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Device not found: " + id));

        if (dto.getName() != null) device.setName(dto.getName());
        if (dto.getDeviceType() != null) device.setDeviceType(dto.getDeviceType());
        if (dto.getManufacturer() != null) device.setManufacturer(dto.getManufacturer());
        if (dto.getModel() != null) device.setModel(dto.getModel());
        if (dto.getSerialNumber() != null) device.setSerialNumber(dto.getSerialNumber());
        if (dto.getStatus() != null) device.setStatus(dto.getStatus());
        if (dto.getLastSeenAt() != null) device.setLastSeenAt(dto.getLastSeenAt());

        Device saved = deviceRepository.save(device);
        return toDto(saved);
    }

    @Transactional
    public void deleteDevice(Long id) {
        if (!deviceRepository.existsById(id)) {
            throw new EntityNotFoundException("Device not found: " + id);
        }
        deviceRepository.deleteById(id);
    }

    private DeviceDto toDto(Device device) {
        return DeviceDto.builder()
                .id(device.getId())
                .stationId(device.getStation().getId())
                .stationName(device.getStation().getName())
                .deviceCode(device.getDeviceCode())
                .name(device.getName())
                .deviceType(device.getDeviceType())
                .manufacturer(device.getManufacturer())
                .model(device.getModel())
                .serialNumber(device.getSerialNumber())
                .status(device.getStatus())
                .installedAt(device.getInstalledAt())
                .lastSeenAt(device.getLastSeenAt())
                .createdAt(device.getCreatedAt())
                .updatedAt(device.getUpdatedAt())
                .build();
    }
}
