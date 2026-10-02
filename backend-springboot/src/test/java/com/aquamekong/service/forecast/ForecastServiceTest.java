package com.aquamekong.service.forecast;

import com.aquamekong.client.MlServiceClient;
import com.aquamekong.dto.forecast.SalinityForecastDto;
import com.aquamekong.entity.forecast.ForecastRun;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.exception.MlServiceException;
import com.aquamekong.repository.forecast.ForecastRunRepository;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.station.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ForecastServiceTest {

    @Mock ForecastRunRepository forecastRunRepository;
    @Mock SalinityForecastRepository salinityForecastRepository;
    @Mock StationRepository stationRepository;
    @Mock MlServiceClient mlServiceClient;
    @Mock TransactionTemplate transactionTemplate;
    @InjectMocks ForecastService forecastService;

    private final Station station = Station.builder().id(1L).code("CT-001").name("Trạm Cần Thơ").build();

    @BeforeEach
    void runTransactionCallbackInline() {
        lenient().when(transactionTemplate.execute(any())).thenAnswer(inv ->
                inv.<TransactionCallback<?>>getArgument(0).doInTransaction(null));
    }

    @Test
    @SuppressWarnings("unchecked")
    void predictCallsMlAndPersistsRunWithForecasts() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        when(stationRepository.existsById(1L)).thenReturn(true);
        when(stationRepository.getReferenceById(1L)).thenReturn(station);
        when(mlServiceClient.predict(1L, 2)).thenReturn(new MlServiceClient.PredictionResponse(1L, List.of(
                new MlServiceClient.PredictionItem(tomorrow, 2.5, 0.9, 2.0, 3.0, "prophet-v1.0"),
                new MlServiceClient.PredictionItem(tomorrow.plusDays(1), 2.7, null, 2.1, 3.3, "prophet-v1.0")
        ), "prophet-v1.0"));
        when(forecastRunRepository.save(any())).thenAnswer(inv -> {
            ForecastRun run = inv.getArgument(0);
            run.setId(42L);
            return run;
        });
        when(salinityForecastRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<SalinityForecastDto> result = forecastService.predict(1L, 2);

        ArgumentCaptor<ForecastRun> run = ArgumentCaptor.forClass(ForecastRun.class);
        verify(forecastRunRepository).save(run.capture());
        assertThat(run.getValue().getModelVersion()).isEqualTo("prophet-v1.0");

        ArgumentCaptor<List<SalinityForecast>> saved = ArgumentCaptor.forClass(List.class);
        verify(salinityForecastRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(2);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getRunId()).isEqualTo(42L);
        assertThat(result.get(0).getStationCode()).isEqualTo("CT-001");
        assertThat(result.get(0).getPredictedSalinity()).isEqualTo(2.5);
        // confidence null từ ML -> mặc định 0.95
        assertThat(result.get(1).getConfidenceLevel()).isEqualTo(0.95);
    }

    @Test
    void predictRejectsUnknownStationWithoutCallingMl() {
        when(stationRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> forecastService.predict(99L, 7))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(mlServiceClient);
    }

    @Test
    void predictDoesNotPersistWhenMlFails() {
        when(stationRepository.existsById(1L)).thenReturn(true);
        when(mlServiceClient.predict(1L, 7)).thenThrow(new MlServiceException("down"));

        assertThatThrownBy(() -> forecastService.predict(1L, 7)).isInstanceOf(MlServiceException.class);
        verifyNoInteractions(forecastRunRepository, salinityForecastRepository);
    }
}
