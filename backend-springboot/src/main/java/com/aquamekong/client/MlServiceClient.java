package com.aquamekong.client;

import com.aquamekong.exception.MlServiceException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    /** Điểm đánh giá ST-GNN đã cài (GET /api/v1/models/stgnn); rỗng nếu chưa cài. */
    public Optional<Map<String, Object>> stgnnModelInfo() {
        try {
            Map<String, Object> body = restClient.get()
                    .uri("/api/v1/models/stgnn")
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            return Optional.ofNullable(body);
        } catch (HttpClientErrorException.NotFound e) {
            return Optional.empty();
        } catch (RestClientException e) {
            log.error("Gọi ML service lấy thông tin ST-GNN thất bại: {}", e.getMessage());
            throw new MlServiceException("Không gọi được ML service: " + e.getMessage(), e);
        }
    }

    /** Backtest độ chính xác của mô hình dự báo (GET /api/v1/evaluation/accuracy), JSON chuyển thẳng cho frontend */
    public Map<String, Object> accuracy(int days) {
        try {
            return restClient.get()
                    .uri(uri -> uri.path("/api/v1/evaluation/accuracy").queryParam("days", days).build())
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
        } catch (RestClientException e) {
            log.error("Gọi ML service lấy độ chính xác dự báo thất bại: {}", e.getMessage());
            throw new MlServiceException("Không gọi được ML service: " + e.getMessage(), e);
        }
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
            @JsonProperty("model_version") String modelVersion,
            // Ngày cuối có dữ liệu đầu vào (chỉ ST-GNN gửi)
            @JsonProperty("data_end") LocalDate dataEnd) {
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
