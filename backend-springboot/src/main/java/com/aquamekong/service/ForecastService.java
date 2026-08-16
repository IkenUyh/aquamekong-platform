package com.aquamekong.service;

import com.aquamekong.entity.SalinityForecast;
import com.aquamekong.entity.Station;
import com.aquamekong.dto.ForecastRequestDto;
import com.aquamekong.repository.SalinityForecastRepository;
import com.aquamekong.repository.StationRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Service that proxies forecast requests to the Python ML service
 * and persists results in the database.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ForecastService {

    private final SalinityForecastRepository forecastRepository;
    private final StationRepository stationRepository;

    @Value("${app.ml-service.base-url:http://localhost:8000}")
    private String mlServiceBaseUrl;

    /**
     * Request a prediction from the ML service and save results.
     */
    @Transactional
    public List<SalinityForecast> requestPrediction(ForecastRequestDto request) {
        Station station = stationRepository.findById(request.getStationId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Station not found: " + request.getStationId()));

        try {
            WebClient client = WebClient.create(mlServiceBaseUrl);

            // Call ML service
            Map<String, Object> mlRequest = Map.of(
                    "station_id", request.getStationId(),
                    "days_ahead", request.getDaysAhead() != null ? request.getDaysAhead() : 7
            );

            List<Map<String, Object>> predictions = client.post()
                    .uri("/api/v1/predict")
                    .bodyValue(mlRequest)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .map(response -> {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> preds = (List<Map<String, Object>>) response.get("predictions");
                        return preds;
                    })
                    .block();

            if (predictions == null || predictions.isEmpty()) {
                log.warn("ML service returned no predictions for station {}", request.getStationId());
                return List.of();
            }

            // Save predictions to database
            List<SalinityForecast> forecasts = predictions.stream()
                    .map(p -> SalinityForecast.builder()
                            .station(station)
                            .forecastDate(LocalDate.parse((String) p.get("date")))
                            .predictedSalinity(((Number) p.get("salinity")).doubleValue())
                            .confidenceLevel(p.get("confidence") != null
                                    ? ((Number) p.get("confidence")).doubleValue() : null)
                            .lowerBound(p.get("lower_bound") != null
                                    ? ((Number) p.get("lower_bound")).doubleValue() : null)
                            .upperBound(p.get("upper_bound") != null
                                    ? ((Number) p.get("upper_bound")).doubleValue() : null)
                            .modelVersion((String) p.getOrDefault("model_version", "prophet-v1.0"))
                            .build())
                    .toList();

            return forecastRepository.saveAll(forecasts);

        } catch (Exception e) {
            log.error("Failed to get prediction from ML service for station {}",
                    request.getStationId(), e);
            throw new RuntimeException("ML service unavailable: " + e.getMessage(), e);
        }
    }

    /**
     * Get saved forecasts for a station.
     */
    @Transactional(readOnly = true)
    public List<SalinityForecast> getForecastsByStation(Long stationId) {
        return forecastRepository.findByStationIdOrderByForecastDateAsc(stationId);
    }
}
