package com.aquamekong.service.watch;

import com.aquamekong.dto.watch.WatchDtos.Outlook;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.entity.user.StationWatch;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.user.StationWatchRepository;
import com.aquamekong.service.push.PushMessage;
import com.aquamekong.service.push.PushService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StationWatchJobTest {

    @Mock StationWatchRepository watchRepository;
    @Mock StationWatchService watchService;
    @Mock PushService pushService;

    private final Station station = Station.builder().id(3L).name("Mỹ Tho").build();

    private StationWatch watch(long id, long userId, double threshold, boolean exceeding) {
        return StationWatch.builder().id(id).user(User.builder().id(userId).build()).station(station)
                .threshold(threshold).crop("Lúa").forecastExceeding(exceeding).build();
    }

    @Test
    void reportsOnlyWatchesWhoseStateChanged() {
        // Số đo mới (hôm nay) 2,5‰: vượt ngưỡng 2 (lúa), dưới ngưỡng 4
        when(watchService.snapshot(3L)).thenReturn(new StationSnapshot(
                Measurement.builder().value(2.5).recordedAt(OffsetDateTime.now()).build(), List.of()));
        StationWatch startsExceeding = watch(1, 10, 2.0, false);
        StationWatch stillExceeding = watch(2, 11, 1.0, true);
        StationWatch backBelow = watch(3, 12, 4.0, true);
        when(watchRepository.findAllByOrderByStationIdAsc()).thenReturn(List.of(startsExceeding, stillExceeding, backBelow));

        new StationWatchJob(watchRepository, watchService, pushService).check();

        // Một trạm chỉ đọc số đo/dự báo một lần cho mọi người theo dõi
        verify(watchService, times(1)).snapshot(3L);
        verify(pushService).notifyUser(eq(10L), any());
        verify(pushService).notifyUser(eq(12L), any());
        verify(pushService, never()).notifyUser(eq(11L), any());
        assertThat(startsExceeding.isForecastExceeding()).isTrue();
        assertThat(backBelow.isForecastExceeding()).isFalse();
        verify(watchRepository).saveAll(List.of(startsExceeding, backBelow));
    }

    @Test
    void forecastMessageTellsWhenToStoreWater() {
        PushMessage message = StationWatchJob.message(watch(1, 10, 2.0, false),
                new Outlook(1.2, OffsetDateTime.of(2026, 10, 8, 0, 0, 0, 0, ZoneOffset.ofHours(7)),
                        LocalDate.of(2026, 10, 12), 2.85, true));

        assertThat(message.title()).isEqualTo("Cảnh báo mặn: Mỹ Tho");
        assertThat(message.body()).isEqualTo("Dự báo vượt 2‰ cho lúa từ ngày 12/10, cao nhất 2,85‰. Nên trữ nước ngọt trước ngày này.");
    }

    @Test
    void backBelowMessageSaysWaterCanBeTaken() {
        PushMessage message = StationWatchJob.message(watch(1, 10, 2.0, true), new Outlook(1.2, null, null, 1.5, false));

        assertThat(message.title()).isEqualTo("Độ mặn đã giảm: Mỹ Tho");
        assertThat(message.body()).contains("dưới ngưỡng 2‰ cho lúa");
    }
}
