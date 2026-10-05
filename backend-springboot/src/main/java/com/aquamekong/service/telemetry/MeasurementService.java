package com.aquamekong.service.telemetry;

import com.aquamekong.dto.telemetry.MeasurementDto;
import com.aquamekong.dto.telemetry.TelemetryIngestDto;
import com.aquamekong.entity.device.Sensor;
import com.aquamekong.entity.enums.QualityStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.device.SensorRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import com.aquamekong.util.MetricTypes;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MeasurementService {

    private final MeasurementRepository measurementRepository;
    private final StationRepository stationRepository;
    private final SensorRepository sensorRepository;

    /** Giới hạn cứng số dòng trả về cho các truy vấn lịch sử (bảng measurements tăng rất nhanh). */
    public static final int MAX_LIMIT = 5000;

    private static Pageable limitOf(int limit) {
        return PageRequest.of(0, Math.max(1, Math.min(limit, MAX_LIMIT)));
    }

    @Transactional(readOnly = true)
    public List<MeasurementDto> getByStationId(Long stationId, String metricType, int limit) {
        List<Measurement> rows = metricType == null || metricType.isBlank()
                ? measurementRepository.findByStationIdOrderByRecordedAtDesc(stationId, limitOf(limit))
                : measurementRepository.findByStationIdAndMetricTypeOrderByRecordedAtDesc(
                        stationId, MetricTypes.normalize(metricType), limitOf(limit));
        return rows
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MeasurementDto> getBySensorId(Long sensorId, int limit) {
        return measurementRepository.findBySensorIdOrderByRecordedAtDesc(sensorId, limitOf(limit))
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MeasurementDto> getByStationAndMetric(Long stationId, String metricType) {
        return measurementRepository.findByStationIdAndMetricTypeOrderByRecordedAtDesc(stationId, MetricTypes.normalize(metricType))
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MeasurementDto> getByStationAndTimeRange(Long stationId, String metricType, OffsetDateTime from, OffsetDateTime to, int limit) {
        List<Measurement> rows = metricType == null || metricType.isBlank()
                ? measurementRepository.findByStationIdAndRecordedAtBetweenOrderByRecordedAtDesc(stationId, from, to, limitOf(limit))
                : measurementRepository.findByStationIdAndMetricTypeAndRecordedAtBetweenOrderByRecordedAtDesc(
                        stationId, MetricTypes.normalize(metricType), from, to, limitOf(limit));
        return rows
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Các số liệu có id > lastId (theo thứ tự ghi), dùng cho poller SSE + cảnh báo.
     */
    @Transactional(readOnly = true)
    public List<MeasurementDto> getNewSince(Long lastId, int limit) {
        return measurementRepository.findByIdGreaterThanOrderByIdAsc(lastId, limitOf(limit))
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Long getMaxId() {
        return measurementRepository.findMaxId();
    }

    @Transactional(readOnly = true)
    public List<MeasurementDto> getLatestPerStation() {
        return measurementRepository.findLatestMeasurementPerStation()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MeasurementDto getLatestByStationAndMetric(Long stationId, String metricType) {
        Measurement measurement = measurementRepository.findLatestByStationIdAndMetricType(stationId, MetricTypes.normalize(metricType));
        return measurement != null ? toDto(measurement) : null;
    }

    @Transactional
    public MeasurementDto ingestTelemetry(TelemetryIngestDto ingestDto) {
        Sensor sensor = sensorRepository.findBySensorCode(ingestDto.getSensorCode())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sensor với mã: " + ingestDto.getSensorCode()));

        Station station = stationRepository.findByCode(ingestDto.getStationCode())
                .orElseGet(() -> {
                    if (sensor.getDevice() != null && sensor.getDevice().getStation() != null) {
                        return sensor.getDevice().getStation();
                    }
                    throw new IllegalArgumentException("Không tìm thấy trạm với mã: " + ingestDto.getStationCode());
                });

        Measurement measurement = Measurement.builder()
                .sensor(sensor)
                .station(station)
                .metricType(ingestDto.getMetricType() != null ? ingestDto.getMetricType() : sensor.getMetricType())
                .value(ingestDto.getValue())
                .unit(ingestDto.getUnit() != null ? ingestDto.getUnit() : sensor.getUnit())
                .recordedAt(ingestDto.getRecordedAt() != null ? ingestDto.getRecordedAt() : OffsetDateTime.now())
                .qualityStatus(QualityStatus.VALID)
                .build();

        Measurement saved = measurementRepository.save(measurement);
        return toDto(saved);
    }

    @Transactional
    public MeasurementDto saveMeasurement(MeasurementDto dto) {
        Sensor sensor = sensorRepository.findById(dto.getSensorId())
                .orElseThrow(() -> new IllegalArgumentException("Sensor không tồn tại với ID: " + dto.getSensorId()));
        Station station = stationRepository.findById(dto.getStationId())
                .orElseThrow(() -> new IllegalArgumentException("Station không tồn tại với ID: " + dto.getStationId()));

        Measurement measurement = Measurement.builder()
                .id(dto.getId())
                .sensor(sensor)
                .station(station)
                .metricType(dto.getMetricType())
                .value(dto.getValue())
                .unit(dto.getUnit())
                .recordedAt(dto.getRecordedAt() != null ? dto.getRecordedAt() : OffsetDateTime.now())
                .qualityStatus(dto.getQualityStatus() != null ? dto.getQualityStatus() : QualityStatus.VALID)
                .build();

        Measurement saved = measurementRepository.save(measurement);
        return toDto(saved);
    }

    public MeasurementDto toDto(Measurement entity) {
        if (entity == null) return null;

        return MeasurementDto.builder()
                .id(entity.getId())
                .sensorId(entity.getSensor() != null ? entity.getSensor().getId() : null)
                .sensorCode(entity.getSensor() != null ? entity.getSensor().getSensorCode() : null)
                .stationId(entity.getStation() != null ? entity.getStation().getId() : null)
                .stationCode(entity.getStation() != null ? entity.getStation().getCode() : null)
                .stationName(entity.getStation() != null ? entity.getStation().getName() : null)
                .metricType(entity.getMetricType())
                .value(entity.getValue())
                .unit(entity.getUnit())
                .recordedAt(entity.getRecordedAt())
                .qualityStatus(entity.getQualityStatus())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
