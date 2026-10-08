package com.aquamekong.service.forecast;

import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.exception.MlServiceException;
import com.aquamekong.repository.forecast.ForecastRunRepository;
import com.aquamekong.repository.station.StationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.TaskScheduler;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DailyForecastJobTest {

    @Mock ForecastService forecastService;
    @Mock StationRepository stationRepository;
    @Mock ForecastRunRepository forecastRunRepository;
    @Mock TaskScheduler taskScheduler;

    private DailyForecastJob job(String cron) {
        return new DailyForecastJob(forecastService, stationRepository, forecastRunRepository, taskScheduler, cron, Duration.ofMinutes(2));
    }

    private static Station station(long id) {
        return Station.builder().id(id).code("S" + id).name("Trạm " + id).build();
    }

    @Test
    void runDailyKeepsGoingWhenOneStationFails() {
        when(stationRepository.findByStatus(StationStatus.ACTIVE)).thenReturn(List.of(station(1), station(2), station(3)));
        when(forecastService.predict(2L, DailyForecastJob.DAYS_AHEAD)).thenThrow(new MlServiceException("ML lỗi", null));

        job("0 30 7 * * *").runDaily();

        verify(forecastService).predict(1L, DailyForecastJob.DAYS_AHEAD);
        verify(forecastService).predict(3L, DailyForecastJob.DAYS_AHEAD);
    }

    @Test
    void catchUpSkipsWhenTodayAlreadyHasARun() {
        when(forecastRunRepository.existsByRunAtAfter(any())).thenReturn(true);

        job("0 30 7 * * *").catchUpIfNoRunToday();

        verifyNoInteractions(stationRepository, forecastService);
    }

    @Test
    void catchUpRunsWhenTodayHasNoRun() {
        when(forecastRunRepository.existsByRunAtAfter(any())).thenReturn(false);
        when(stationRepository.findByStatus(StationStatus.ACTIVE)).thenReturn(List.of(station(1)));

        job("0 30 7 * * *").catchUpIfNoRunToday();

        verify(forecastService).predict(1L, DailyForecastJob.DAYS_AHEAD);
    }

    @Test
    void disabledCronSchedulesNoCatchUp() {
        job("-").scheduleCatchUp();

        verify(taskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
    }
}
