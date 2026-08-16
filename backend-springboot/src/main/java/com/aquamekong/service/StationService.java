package com.aquamekong.service;

import com.aquamekong.dto.GeoJsonResponse;
import com.aquamekong.dto.StationDto;
import com.aquamekong.entity.Station;
import com.aquamekong.entity.WaterMetric;
import com.aquamekong.repository.StationRepository;
import com.aquamekong.repository.WaterMetricRepository;
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
    private final WaterMetricRepository waterMetricRepository;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    /**
     * Lấy tất cả trạm kèm metrics mới nhất.
     */
    @Transactional(readOnly = true)
    public List<StationDto> getAllStations() {
        List<Station> stations = stationRepository.findAll();
        List<WaterMetric> latestMetrics = waterMetricRepository.findLatestMetricPerStation();

        // Map station_id → latest metric
        Map<Long, WaterMetric> metricMap = latestMetrics.stream()
                .collect(Collectors.toMap(wm -> wm.getStation().getId(), wm -> wm));

        return stations.stream()
                .map(s -> toDto(s, metricMap.get(s.getId())))
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
        WaterMetric latestMetric = waterMetricRepository.findLatestByStationId(id);
        return toDto(station, latestMetric);
    }

    /**
     * Tạo trạm mới.
     */
    @Transactional
    public StationDto createStation(StationDto dto) {
        Station station = Station.builder()
                .code(dto.getCode())
                .name(dto.getName())
                .location(geometryFactory.createPoint(
                        new Coordinate(dto.getLongitude(), dto.getLatitude())))
                .riverName(dto.getRiverName())
                .province(dto.getProvince())
                .status(dto.getStatus() != null ? dto.getStatus() : "ACTIVE")
                .build();

        Station saved = stationRepository.save(station);
        return toDto(saved, null);
    }

    /**
     * Cập nhật trạm.
     */
    @Transactional
    public StationDto updateStation(Long id, StationDto dto) {
        Station station = stationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Station not found: " + id));

        if (dto.getName() != null) station.setName(dto.getName());
        if (dto.getRiverName() != null) station.setRiverName(dto.getRiverName());
        if (dto.getProvince() != null) station.setProvince(dto.getProvince());
        if (dto.getStatus() != null) station.setStatus(dto.getStatus());
        if (dto.getLongitude() != null && dto.getLatitude() != null) {
            station.setLocation(geometryFactory.createPoint(
                    new Coordinate(dto.getLongitude(), dto.getLatitude())));
        }

        Station saved = stationRepository.save(station);
        WaterMetric latestMetric = waterMetricRepository.findLatestByStationId(id);
        return toDto(saved, latestMetric);
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

        List<WaterMetric> latestMetrics = waterMetricRepository.findLatestMetricPerStation();
        Map<Long, WaterMetric> metricMap = latestMetrics.stream()
                .collect(Collectors.toMap(wm -> wm.getStation().getId(), wm -> wm));

        List<GeoJsonResponse.Feature> features = stations.stream()
                .map(s -> toGeoJsonFeature(toDto(s, metricMap.get(s.getId()))))
                .collect(Collectors.toList());

        return GeoJsonResponse.builder()
                .type("FeatureCollection")
                .features(features)
                .build();
    }

    // ===== Helpers =====

    private StationDto toDto(Station station, WaterMetric metric) {
        StationDto.StationDtoBuilder builder = StationDto.builder()
                .id(station.getId())
                .code(station.getCode())
                .name(station.getName())
                .longitude(station.getLocation().getX())
                .latitude(station.getLocation().getY())
                .riverName(station.getRiverName())
                .province(station.getProvince())
                .status(station.getStatus());

        if (metric != null) {
            builder.latestSalinity(metric.getSalinity())
                    .latestWaterLevel(metric.getWaterLevel())
                    .latestFlowRate(metric.getFlowRate())
                    .salinityLevel(classifySalinity(metric.getSalinity()));
        }

        return builder.build();
    }

    private GeoJsonResponse.Feature toGeoJsonFeature(StationDto dto) {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("id", dto.getId());
        properties.put("code", dto.getCode());
        properties.put("name", dto.getName());
        properties.put("riverName", dto.getRiverName());
        properties.put("province", dto.getProvince());
        properties.put("status", dto.getStatus());
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

    /**
     * Phân loại độ mặn:
     * < 1‰: LOW (an toàn)
     * 1-4‰: MEDIUM (cảnh báo)
     * > 4‰: HIGH (nguy hiểm)
     */
    public static String classifySalinity(Double salinity) {
        if (salinity == null) return "UNKNOWN";
        if (salinity < 1.0) return "LOW";
        if (salinity <= 4.0) return "MEDIUM";
        return "HIGH";
    }
}
