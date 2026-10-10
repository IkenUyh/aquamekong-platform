package com.aquamekong.service.forecast;

import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.forecast.ForecastRun;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.exception.MlServiceException;
import com.aquamekong.repository.forecast.ForecastRunRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.TaskScheduler;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DailyForecastJobTest {

    private static final ZoneOffset VN = ZoneOffset.ofHours(7);

    @Mock ForecastService forecastService;
    @Mock StationRepository stationRepository;
    @Mock ForecastRunRepository forecastRunRepository;
    @Mock MeasurementRepository measurementRepository;
    @Mock TaskScheduler taskScheduler;
    @Mock ApplicationEventPublisher eventPublisher;

    @BeforeEach
    void setUp() {
        when(stationRepository.findByStatus(StationStatus.ACTIVE)).thenReturn(List.of(station(1), station(2), station(3)));
    }

    private DailyForecastJob job(String cron) {
        return new DailyForecastJob(forecastService, stationRepository, forecastRunRepository, measurementRepository,
                taskScheduler, eventPublisher, cron, Duration.ofMinutes(2));
    }

    private static Station station(long id) {
        return Station.builder().id(id).code("S" + id).name("Trạm " + id).build();
    }

    private static OffsetDateTime vn(int day, int hour, int minute) {
        return OffsetDateTime.of(2026, 10, day, hour, minute, 0, 0, VN);
    }

    private void lastRunInDb(OffsetDateTime runAt) {
        when(forecastRunRepository.findFirstByOrderByRunAtDesc())
                .thenReturn(Optional.ofNullable(runAt).map(t -> ForecastRun.builder().runAt(t).build()));
    }

    private void newestImport(OffsetDateTime createdAt) {
        when(measurementRepository.findMaxId()).thenReturn(99L);
        when(measurementRepository.findById(99L)).thenReturn(Optional.of(Measurement.builder().createdAt(createdAt).build()));
    }

    @Test
    void runsWhenTodayHasNoForecastYet() {
        lastRunInDb(vn(9, 7, 30));
        newestImport(vn(9, 6, 10));

        job("0 */30 6-22 * * *").refreshIfNeeded(vn(10, 8, 30).toInstant());

        verify(forecastService, times(3)).predict(anyLong(), anyInt());
    }

    @Test
    void reRunsWhenReadingsArriveAfterTheMorningRun() {
        // GitHub Actions trễ: lượt 08:36 chạy trên số đo cũ, số đo của hôm qua về lúc 09:12
        lastRunInDb(vn(10, 8, 36));
        newestImport(vn(10, 9, 12));
        DailyForecastJob job = job("0 */30 6-22 * * *");

        job.refreshIfNeeded(vn(10, 9, 30).toInstant());
        job.refreshIfNeeded(vn(10, 10, 0).toInstant());

        // Chạy lại đúng một lần: lượt 09:30 đã có số đo 09:12
        verify(forecastService, times(3)).predict(anyLong(), anyInt());
    }

    @Test
    void skipsWhenNothingNewArrived() {
        lastRunInDb(vn(10, 9, 30));
        newestImport(vn(10, 9, 12));

        job("0 */30 6-22 * * *").refreshIfNeeded(vn(10, 10, 0).toInstant());

        verifyNoInteractions(forecastService, eventPublisher);
    }

    @Test
    void oneFailingStationDoesNotStopTheRunAndWatchersAreToldAfterwards() {
        lastRunInDb(null);
        when(forecastService.predict(2L, DailyForecastJob.DAYS_AHEAD)).thenThrow(new MlServiceException("ML lỗi", null));

        job("0 */30 6-22 * * *").refreshIfNeeded(vn(10, 7, 0).toInstant());

        verify(forecastService).predict(1L, DailyForecastJob.DAYS_AHEAD);
        verify(forecastService).predict(3L, DailyForecastJob.DAYS_AHEAD);
        ArgumentCaptor<ForecastsRefreshedEvent> event = ArgumentCaptor.forClass(ForecastsRefreshedEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        assertThat(event.getValue().succeeded()).isEqualTo(2);
        assertThat(event.getValue().failed()).isEqualTo(1);
    }

    @Test
    void disabledCronSchedulesNoCatchUp() {
        job("-").scheduleCatchUp();

        verify(taskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
    }
}
