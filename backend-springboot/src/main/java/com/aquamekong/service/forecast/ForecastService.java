package com.aquamekong.service.forecast;

import com.aquamekong.dto.forecast.ForecastRunDto;
import com.aquamekong.dto.forecast.SalinityForecastDto;
import com.aquamekong.entity.enums.ForecastRunStatus;
import com.aquamekong.entity.forecast.ForecastRun;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.forecast.ForecastRunRepository;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.station.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional(readOnly = true)
    public List<ForecastRunDto> getAllRuns() {
        return forecastRunRepository.findAll()
                .stream()
                .map(this::toRunDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ForecastRunDto getRunById(Long id) {
        return forecastRunRepository.findById(id)
                .map(this::toRunDto)
                .orElse(null);
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
        return salinityForecastRepository.findByStationIdOrderByForecastDateAsc(stationId)
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
