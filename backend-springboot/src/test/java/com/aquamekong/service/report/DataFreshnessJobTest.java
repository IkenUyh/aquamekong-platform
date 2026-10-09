package com.aquamekong.service.report;

import com.aquamekong.dto.report.ReportDtos.DataFreshness;
import com.aquamekong.service.push.PushMessage;
import com.aquamekong.service.push.PushService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DataFreshnessJobTest {

    @Mock DataFreshnessService freshnessService;
    @Mock PushService pushService;

    private static final OffsetDateTime OCT_7 = OffsetDateTime.of(2026, 10, 7, 0, 0, 0, 0, ZoneOffset.ofHours(7));

    @Test
    void staleDataNotifiesTheStaff() {
        when(freshnessService.status()).thenReturn(new DataFreshness(OCT_7, LocalDate.of(2026, 10, 8), true, 0, 40));

        new DataFreshnessJob(freshnessService, pushService).check();

        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(pushService).notifyStaff(message.capture());
        assertThat(message.getValue().body()).contains("08/10").contains("07/10");
        assertThat(message.getValue().url()).isEqualTo("/");
    }

    @Test
    void freshDataSendsNothing() {
        when(freshnessService.status()).thenReturn(new DataFreshness(OCT_7, LocalDate.of(2026, 10, 7), false, 39, 40));

        new DataFreshnessJob(freshnessService, pushService).check();

        verifyNoInteractions(pushService);
    }

    @Test
    void messageWithoutAnyMeasurementSaysSo() {
        PushMessage message = DataFreshnessJob.message(new DataFreshness(null, LocalDate.of(2026, 10, 8), true, 0, 40));

        assertThat(message.body()).contains("08/10").contains("chưa có số đo nào");
    }
}
