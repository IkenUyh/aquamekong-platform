package com.aquamekong.service.watch;

import com.aquamekong.dto.watch.WatchDtos.Outlook;
import com.aquamekong.dto.watch.WatchDtos.WatchRequest;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.entity.user.StationWatch;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import com.aquamekong.repository.user.StationWatchRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StationWatchServiceTest {

    private static final ZoneOffset VN = ZoneOffset.ofHours(7);
    /** 09/10/2026 08:00 giờ VN */
    private static final Instant NOW = OffsetDateTime.of(2026, 10, 9, 8, 0, 0, 0, VN).toInstant();

    @Mock StationWatchRepository watchRepository;
    @Mock UserRepository userRepository;
    @Mock StationRepository stationRepository;
    @Mock MeasurementRepository measurementRepository;
    @Mock SalinityForecastRepository forecastRepository;
    StationWatchService service;

    private final User alice = User.builder().id(1L).username("alice").build();
    private final User bob = User.builder().id(2L).username("bob").build();
    private final Station station = Station.builder().id(3L).name("Mỹ Tho").build();

    @BeforeEach
    void setUp() {
        service = new StationWatchService(watchRepository, userRepository, stationRepository, measurementRepository, forecastRepository);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(stationRepository.findById(3L)).thenReturn(Optional.of(station));
        when(forecastRepository.findLatestRunByStationId(3L)).thenReturn(List.of());
        when(watchRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private static Measurement reading(double value, int day) {
        return Measurement.builder().value(value).recordedAt(OffsetDateTime.of(2026, 10, day, 0, 0, 0, 0, VN)).build();
    }

    private static SalinityForecast forecast(int day, double value) {
        return SalinityForecast.builder().forecastDate(LocalDate.of(2026, 10, day)).predictedSalinity(value).build();
    }

    @Test
    void forecastAboveThresholdGivesTheFirstDayAndThePeak() {
        StationSnapshot snapshot = new StationSnapshot(reading(1.2, 8),
                List.of(forecast(8, 9.0), forecast(10, 1.8), forecast(12, 2.4), forecast(13, 2.9)));

        Outlook outlook = StationWatchService.outlook(snapshot, 2.0, NOW);

        assertThat(outlook.exceeding()).isTrue();
        assertThat(outlook.firstExceedDate()).isEqualTo(LocalDate.of(2026, 10, 12));
        // Ngày 08/10 đã qua: không tính vào dự báo
        assertThat(outlook.forecastMax()).isEqualTo(2.9);
        assertThat(outlook.latestSalinity()).isEqualTo(1.2);
    }

    @Test
    void latestReadingAboveThresholdCountsEvenWithoutForecast() {
        Outlook outlook = StationWatchService.outlook(new StationSnapshot(reading(2.5, 8), List.of()), 2.0, NOW);

        assertThat(outlook.exceeding()).isTrue();
        assertThat(outlook.firstExceedDate()).isNull();
        assertThat(outlook.forecastMax()).isNull();
    }

    @Test
    void readingFromAStationThatStoppedReportingIsIgnored() {
        Outlook outlook = StationWatchService.outlook(new StationSnapshot(reading(9.0, 1), List.of(forecast(10, 1.0))), 2.0, NOW);

        assertThat(outlook.exceeding()).isFalse();
        assertThat(outlook.latestSalinity()).isNull();
    }

    @Test
    void savingRemembersTheCurrentStateSoTheJobOnlyReportsChanges() {
        when(watchRepository.findByUserIdAndStationId(1L, 3L)).thenReturn(Optional.empty());
        when(measurementRepository.findLatestByStationIdAndMetricType(3L, "salinity"))
                .thenReturn(Measurement.builder().value(5.0).recordedAt(OffsetDateTime.now()).build());

        var dto = service.save("alice", new WatchRequest(3L, 2.0, " Lúa "));

        assertThat(dto.crop()).isEqualTo("Lúa");
        assertThat(dto.outlook().exceeding()).isTrue();
        verify(watchRepository).save(argThat(StationWatch::isForecastExceeding));
    }

    @Test
    void savingAnExistingWatchUpdatesTheThreshold() {
        StationWatch existing = StationWatch.builder().id(7L).user(alice).station(station).threshold(4.0).crop("Lúa").build();
        when(watchRepository.findByUserIdAndStationId(1L, 3L)).thenReturn(Optional.of(existing));

        var dto = service.save("alice", new WatchRequest(3L, 0.5, ""));

        assertThat(dto.id()).isEqualTo(7L);
        assertThat(existing.getThreshold()).isEqualTo(0.5);
        assertThat(existing.getCrop()).isNull();
        verify(watchRepository, never()).countByUserId(any());
    }

    @Test
    void watchCountIsLimited() {
        when(watchRepository.findByUserIdAndStationId(1L, 3L)).thenReturn(Optional.empty());
        when(watchRepository.countByUserId(1L)).thenReturn((long) StationWatchService.MAX_WATCHES_PER_USER);

        assertThatThrownBy(() -> service.save("alice", new WatchRequest(3L, 2.0, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(watchRepository, never()).save(any());
    }

    @Test
    void unknownStationIsNotFound() {
        assertThatThrownBy(() -> service.save("alice", new WatchRequest(99L, 2.0, null)))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void cannotDeleteSomeoneElsesWatch() {
        when(watchRepository.findById(7L)).thenReturn(Optional.of(StationWatch.builder().id(7L).user(bob).station(station).build()));

        service.delete("alice", 7L);

        verify(watchRepository, never()).delete(any());
    }
}
