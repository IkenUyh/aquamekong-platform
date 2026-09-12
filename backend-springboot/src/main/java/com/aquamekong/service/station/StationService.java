package com.aquamekong.service.station;

import com.aquamekong.dto.GeoJsonResponse;
import com.aquamekong.dto.station.StationDto;
import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.station.River;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.station.RiverRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StationService {

    private final StationRepository stationRepository;
    private final RiverRepository riverRepository;
    private final MeasurementRepository measurementRepository;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    /**
     * Lấy tất cả trạm kèm metrics mới nhất.
     */
    @Transactional(readOnly = true)
    public List<StationDto> getAllStations() {
        List<Station> stations = stationRepository.findAll();
        List<Measurement> latestMeasurements = measurementRepository.findLatestMeasurementPerStation();

        Map<Long, List<Measurement>> measurementMap = latestMeasurements.stream()
                .collect(Collectors.groupingBy(m -> m.getStation().getId()));

        return stations.stream()
                .map(s -> toDto(s, measurementMap.get(s.getId())))
                .collect(Collectors.toList());
    }

    /**
     * Lấy tất cả trạm dưới dạng GeoJSON FeatureCollection.
     */
    @Transactional(readOnly = true)
    public GeoJsonResponse getAllStationsAsGeoJson() {
        List<StationDto> stations = getAllStations();

        List<GeoJsonResponse.Feature> features = stations.stream()
                .map(this::toGeoJsonFeature)
                .collect(Collectors.toList());

        return GeoJsonResponse.builder()
                .type("FeatureCollection")
                .features(features)
                .build();
    }

    /**
     * Lấy chi tiết 1 trạm.
     */
    @Transactional(readOnly = true)
    public StationDto getStationById(Long id) {
        Station station = stationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Station not found: " + id));
        List<Measurement> measurements = measurementRepository.findByStationIdOrderByRecordedAtDesc(id);
        return toDto(station, measurements);
    }

    /**
     * Tạo trạm mới.
     */
    @Transactional
    public StationDto createStation(StationDto dto) {
        River river = null;
        if (dto.getRiverId() != null) {
            river = riverRepository.findById(dto.getRiverId())
                    .orElseThrow(() -> new EntityNotFoundException("River not found: " + dto.getRiverId()));
        }

        Station station = Station.builder()
                .code(dto.getCode())
                .name(dto.getName())
                .river(river)
                .location(geometryFactory.createPoint(
                        new Coordinate(dto.getLongitude(), dto.getLatitude())))
                .province(dto.getProvince())
                .status(dto.getStatus() != null ? dto.getStatus() : StationStatus.ACTIVE)
                .build();

        Station saved = stationRepository.save(station);
        return toDto(saved, Collections.emptyList());
    }

    /**
     * Cập nhật trạm.
     */
    @Transactional
    public StationDto updateStation(Long id, StationDto dto) {
        Station station = stationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Station not found: " + id));

        if (dto.getRiverId() != null) {
            River river = riverRepository.findById(dto.getRiverId())
                    .orElseThrow(() -> new EntityNotFoundException("River not found: " + dto.getRiverId()));
            station.setRiver(river);
        }
        if (dto.getName() != null) station.setName(dto.getName());
        if (dto.getProvince() != null) station.setProvince(dto.getProvince());
        if (dto.getStatus() != null) station.setStatus(dto.getStatus());
        if (dto.getLongitude() != null && dto.getLatitude() != null) {
            station.setLocation(geometryFactory.createPoint(
                    new Coordinate(dto.getLongitude(), dto.getLatitude())));
        }

        Station saved = stationRepository.save(station);
        List<Measurement> measurements = measurementRepository.findByStationIdOrderByRecordedAtDesc(id);
        return toDto(saved, measurements);
    }

    /**
     * Xóa trạm.
     */
    @Transactional
    public void deleteStation(Long id) {
        if (!stationRepository.existsById(id)) {
            throw new EntityNotFoundException("Station not found: " + id);
        }
        stationRepository.deleteById(id);
    }

    /**
     * Tìm trạm trong bán kính (km).
     */
    @Transactional(readOnly = true)
    public GeoJsonResponse findNearbyStations(double lng, double lat, double radiusKm) {
        double radiusMeters = radiusKm * 1000;
        List<Station> stations = stationRepository.findNearbyStations(lng, lat, radiusMeters);

        List<Measurement> latestMeasurements = measurementRepository.findLatestMeasurementPerStation();
        Map<Long, List<Measurement>> measurementMap = latestMeasurements.stream()
                .collect(Collectors.groupingBy(m -> m.getStation().getId()));

        List<GeoJsonResponse.Feature> features = stations.stream()
                .map(s -> toGeoJsonFeature(toDto(s, measurementMap.get(s.getId()))))
                .collect(Collectors.toList());

        return GeoJsonResponse.builder()
                .type("FeatureCollection")
                .features(features)
                .build();
    }

    // ===== Helpers =====

    private StationDto toDto(Station station, List<Measurement> measurements) {
        StationDto.StationDtoBuilder builder = StationDto.builder()
                .id(station.getId())
                .riverId(station.getRiver() != null ? station.getRiver().getId() : null)
                .riverName(station.getRiver() != null ? station.getRiver().getName() : null)
                .code(station.getCode())
                .name(station.getName())
                .longitude(station.getLocation().getX())
                .latitude(station.getLocation().getY())
                .province(station.getProvince())
                .status(station.getStatus() != null ? station.getStatus() : StationStatus.ACTIVE)
                .createdAt(station.getCreatedAt())
                .updatedAt(station.getUpdatedAt());

        if (measurements != null && !measurements.isEmpty()) {
            for (Measurement m : measurements) {
                if ("SALINITY".equalsIgnoreCase(m.getMetricType())) {
                    builder.latestSalinity(m.getValue());
                    builder.salinityLevel(classifySalinity(m.getValue()));
                } else if ("WATER_LEVEL".equalsIgnoreCase(m.getMetricType())) {
                    builder.latestWaterLevel(m.getValue());
                } else if ("FLOW_RATE".equalsIgnoreCase(m.getMetricType())) {
                    builder.latestFlowRate(m.getValue());
                }
            }
        }

        return builder.build();
    }

    private GeoJsonResponse.Feature toGeoJsonFeature(StationDto dto) {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("id", dto.getId());
        properties.put("riverId", dto.getRiverId());
        properties.put("riverName", dto.getRiverName());
        properties.put("code", dto.getCode());
        properties.put("name", dto.getName());
        properties.put("province", dto.getProvince());
        properties.put("status", dto.getStatus() != null ? dto.getStatus().name() : "ACTIVE");
        properties.put("latestSalinity", dto.getLatestSalinity());
        properties.put("latestWaterLevel", dto.getLatestWaterLevel());
        properties.put("latestFlowRate", dto.getLatestFlowRate());
        properties.put("salinityLevel", dto.getSalinityLevel());

        return GeoJsonResponse.Feature.builder()
                .type("Feature")
                .geometry(GeoJsonResponse.Geometry.builder()
                        .type("Point")
                        .coordinates(new double[]{dto.getLongitude(), dto.getLatitude()})
                        .build())
                .properties(properties)
                .build();
    }

    public static String classifySalinity(Double salinity) {
        if (salinity == null) return "UNKNOWN";
        if (salinity < 1.0) return "LOW";
        if (salinity <= 4.0) return "MEDIUM";
        return "HIGH";
    }
}
