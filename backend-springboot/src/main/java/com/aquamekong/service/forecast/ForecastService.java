package com.aquamekong.service.forecast;

import com.aquamekong.client.MlServiceClient;
import com.aquamekong.dto.forecast.ForecastRunDto;
import com.aquamekong.dto.forecast.SalinityForecastDto;
import com.aquamekong.entity.enums.ForecastRunStatus;
import com.aquamekong.entity.forecast.ForecastRun;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.forecast.ForecastRunRepository;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.station.StationRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ForecastService {

    private final ForecastRunRepository forecastRunRepository;
    private final SalinityForecastRepository salinityForecastRepository;
    private final StationRepository stationRepository;
    private final MlServiceClient mlServiceClient;
    private final TransactionTemplate transactionTemplate;

    @Transactional(readOnly = true)
    public List<ForecastRunDto> getAllRuns(int limit) {
        return forecastRunRepository.findAllByOrderByRunAtDesc(PageRequest.of(0, Math.max(1, Math.min(limit, 1000))))
                .stream()
                .map(this::toRunDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ForecastRunDto getRunById(Long id) {
        return forecastRunRepository.findById(id)
                .map(this::toRunDto)
                .orElseThrow(() -> new EntityNotFoundException("ForecastRun không tồn tại với ID: " + id));
    }

    @Transactional
    public ForecastRunDto createRun(ForecastRunDto runDto) {
        ForecastRun run = ForecastRun.builder()
                .modelVersion(runDto.getModelVersion())
                .runAt(runDto.getRunAt() != null ? runDto.getRunAt() : OffsetDateTime.now())
                .inputFrom(runDto.getInputFrom())
                .inputTo(runDto.getInputTo())
                .status(runDto.getStatus() != null ? runDto.getStatus() : ForecastRunStatus.SUCCESS)
                .build();

        ForecastRun saved = forecastRunRepository.save(run);
        return toRunDto(saved);
    }

    @Transactional(readOnly = true)
    public List<SalinityForecastDto> getForecastsByStationId(Long stationId) {
        return salinityForecastRepository.findLatestRunByStationId(stationId)
                .stream()
                .map(this::toSalinityDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SalinityForecastDto> getForecastsByRunId(Long runId) {
        return salinityForecastRepository.findByRunId(runId)
                .stream()
                .map(this::toSalinityDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SalinityForecastDto> getForecastsByStationAndDateRange(Long stationId, LocalDate from, LocalDate to) {
        return salinityForecastRepository.findByStationIdAndForecastDateBetween(stationId, from, to)
                .stream()
                .map(this::toSalinityDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public SalinityForecastDto saveForecast(SalinityForecastDto dto) {
        ForecastRun run = forecastRunRepository.findById(dto.getRunId())
                .orElseThrow(() -> new IllegalArgumentException("ForecastRun không tồn tại với ID: " + dto.getRunId()));

        Station station = stationRepository.findById(dto.getStationId())
                .orElseThrow(() -> new IllegalArgumentException("Station không tồn tại với ID: " + dto.getStationId()));

        SalinityForecast forecast = SalinityForecast.builder()
                .id(dto.getId())
                .run(run)
                .station(station)
                .forecastDate(dto.getForecastDate())
                .predictedSalinity(dto.getPredictedSalinity())
                .lowerBound(dto.getLowerBound())
                .upperBound(dto.getUpperBound())
                .confidenceLevel(dto.getConfidenceLevel() != null ? dto.getConfidenceLevel() : 0.95)
                .build();

        SalinityForecast saved = salinityForecastRepository.save(forecast);
        return toSalinityDto(saved);
    }

    /**
     * Gọi ML service dự báo cho trạm, lưu thành 1 forecast_run + các salinity_forecasts.
     * Lời gọi HTTP nằm ngoài transaction để không giữ connection DB trong lúc chờ ML.
     */
    public List<SalinityForecastDto> predict(Long stationId, int daysAhead) {
        if (!stationRepository.existsById(stationId)) {
            throw new IllegalArgumentException("Station không tồn tại với ID: " + stationId);
        }

        MlServiceClient.PredictionResponse response = mlServiceClient.predict(stationId, daysAhead);

        return transactionTemplate.execute(status -> {
            Station station = stationRepository.getReferenceById(stationId);
            ForecastRun run = forecastRunRepository.save(ForecastRun.builder()
                    .modelVersion(response.modelVersion() != null ? response.modelVersion() : "unknown")
                    .runAt(OffsetDateTime.now())
                    .status(ForecastRunStatus.SUCCESS)
                    .build());

            List<SalinityForecast> forecasts = response.predictions().stream()
                    .map(p -> SalinityForecast.builder()
                            .run(run)
                            .station(station)
                            .forecastDate(p.date())
                            .predictedSalinity(p.salinity())
                            .lowerBound(p.lowerBound())
                            .upperBound(p.upperBound())
                            .confidenceLevel(p.confidence() != null ? p.confidence() : 0.95)
                            .build())
                    .collect(Collectors.toList());

            return salinityForecastRepository.saveAll(forecasts).stream()
                    .map(this::toSalinityDto)
                    .collect(Collectors.toList());
        });
    }

    public ForecastRunDto toRunDto(ForecastRun entity) {
        if (entity == null) return null;
        return ForecastRunDto.builder()
                .id(entity.getId())
                .modelVersion(entity.getModelVersion())
                .runAt(entity.getRunAt())
                .inputFrom(entity.getInputFrom())
                .inputTo(entity.getInputTo())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    public SalinityForecastDto toSalinityDto(SalinityForecast entity) {
        if (entity == null) return null;
        return SalinityForecastDto.builder()
                .id(entity.getId())
                .runId(entity.getRun() != null ? entity.getRun().getId() : null)
                .modelVersion(entity.getRun() != null ? entity.getRun().getModelVersion() : null)
                .stationId(entity.getStation() != null ? entity.getStation().getId() : null)
                .stationCode(entity.getStation() != null ? entity.getStation().getCode() : null)
                .stationName(entity.getStation() != null ? entity.getStation().getName() : null)
                .forecastDate(entity.getForecastDate())
                .predictedSalinity(entity.getPredictedSalinity())
                .lowerBound(entity.getLowerBound())
                .upperBound(entity.getUpperBound())
                .confidenceLevel(entity.getConfidenceLevel())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
