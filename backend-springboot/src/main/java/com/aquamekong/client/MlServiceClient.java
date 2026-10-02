package com.aquamekong.client;

import com.aquamekong.exception.MlServiceException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.LocalDate;
import java.util.List;

/**
 * HTTP client gọi sang ML service (FastAPI) — POST /api/v1/predict.
 */
@Slf4j
@Component
public class MlServiceClient {

    private final RestClient restClient;

    public MlServiceClient(@Qualifier("mlRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    public PredictionResponse predict(Long stationId, int daysAhead) {
        try {
            PredictionResponse response = restClient.post()
                    .uri("/api/v1/predict")
                    .body(new PredictionRequest(stationId, daysAhead))
                    .retrieve()
                    .body(PredictionResponse.class);
            if (response == null || response.predictions() == null) {
                throw new MlServiceException("ML service trả về dữ liệu rỗng cho trạm " + stationId);
            }
            return response;
        } catch (RestClientException e) {
            log.error("Gọi ML service thất bại cho trạm {}: {}", stationId, e.getMessage());
            throw new MlServiceException("Không gọi được ML service: " + e.getMessage(), e);
        }
    }

    public record PredictionRequest(
            @JsonProperty("station_id") Long stationId,
            @JsonProperty("days_ahead") int daysAhead) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PredictionResponse(
            @JsonProperty("station_id") Long stationId,
            List<PredictionItem> predictions,
            @JsonProperty("model_version") String modelVersion) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PredictionItem(
            LocalDate date,
            Double salinity,
            Double confidence,
            @JsonProperty("lower_bound") Double lowerBound,
            @JsonProperty("upper_bound") Double upperBound,
            @JsonProperty("model_version") String modelVersion) {
    }
}
