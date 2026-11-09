package com.aquamekong.service.report;

import com.aquamekong.client.MlServiceClient;
import com.aquamekong.client.MlServiceClient.EarlyWarningEpisodes;
import com.aquamekong.client.MlServiceClient.Episode;
import com.aquamekong.dto.report.ReplayDtos.Day;
import com.aquamekong.dto.report.ReplayDtos.EarlyWarning;
import com.aquamekong.dto.report.ReplayDtos.Event;
import com.aquamekong.dto.report.ReplayDtos.EventType;
import com.aquamekong.dto.report.ReplayDtos.Station;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class ReplayServiceTest {

    private static final LocalDate D1 = LocalDate.of(2024, 3, 1);

    private final Station a = new Station(1L, "A", "Trạm A", 9.5, 105.2, 4.0);
    private final Station b = new Station(2L, "B", "Trạm B", 9.7, 105.4, 2.0);

    @Test
    void opensWhenAboveThresholdClosesWhenBackBelowAndKeepsStateOnMissingDays() {
        Map<Long, Map<LocalDate, Double>> daily = Map.of(
                1L, Map.of(D1, 3.0, D1.plusDays(1), 5.0, /* ngày 3 mất số đo */ D1.plusDays(3), 3.5),
                2L, Map.of(D1, 2.5, D1.plusDays(1), 2.5, D1.plusDays(2), 1.0, D1.plusDays(3), 1.0));

        List<Day> days = ReplayService.buildDays(List.of(a, b), daily, D1, D1.plusDays(3));

        assertThat(days).extracting(Day::aboveCount).containsExactly(1, 2, 0, 0);
        assertThat(days).extracting(Day::openCount).containsExactly(1, 2, 1, 0);
        assertThat(days.get(0).events()).containsExactly(Event.measured(2L, EventType.OPENED, 2.5));
        assertThat(days.get(1).events()).containsExactly(Event.measured(1L, EventType.OPENED, 5.0));
        assertThat(days.get(2).events()).containsExactly(Event.measured(2L, EventType.RESOLVED, 1.0));
        assertThat(days.get(3).events()).containsExactly(Event.measured(1L, EventType.RESOLVED, 3.5));
        assertThat(days.get(2).salinity()).isEqualTo(Arrays.asList(null, 1.0));
    }

    @Test
    void earlyWarningShowsOnTheMorningItWasSentAndTheExceedanceRecordsTheLead() {
        Map<Long, Map<LocalDate, Double>> daily = Map.of(1L, Map.of(
                D1, 3.0, D1.plusDays(1), 3.2, D1.plusDays(2), 3.5, D1.plusDays(3), 4.6, D1.plusDays(4), 4.8));
        // Sáng ngày 2 (D1+1) báo có thể vượt từ ngày D1+3; số đo vượt của D1+3 về sáng D1+4 (HIT)
        Episode warning = new Episode(D1.plusDays(1), D1.plusDays(4), "HIT", D1.plusDays(3), 4.9);

        List<Day> days = ReplayService.buildDays(List.of(a), daily, D1, D1.plusDays(4), Map.of(1L, List.of(warning)));

        assertThat(days.get(1).events()).containsExactly(
                new Event(1L, EventType.WARNED, 4.9, null, D1.plusDays(3), "HIT", D1.plusDays(4)));
        assertThat(days).extracting(Day::warningCount).containsExactly(0, 1, 1, 1, 0);
        assertThat(days.get(3).events()).containsExactly(new Event(1L, EventType.OPENED, 4.6, 2, null, null, null));

        EarlyWarning summary = ReplayService.summarize(days, daily, new EarlyWarningEpisodes(true,
                List.of(new MlServiceClient.Season("Mùa khô 2023–2024", D1.minusDays(91), D1.plusDays(91))),
                Map.of(1L, List.of(warning))));
        assertThat(summary.opened()).isEqualTo(1);
        assertThat(summary.warnedAhead()).isEqualTo(1);
        assertThat(summary.medianLeadDays()).isEqualTo(2.0);
        assertThat(summary.warnings()).isEqualTo(1);
        assertThat(summary.hits()).isEqualTo(1);
    }

    @Test
    void exceedanceOnTheFirstDayWithDataIsNotCountedAsANewOnset() {
        Map<Long, Map<LocalDate, Double>> daily = Map.of(1L, Map.of(D1, 5.0, D1.plusDays(1), 5.0));
        List<Day> days = ReplayService.buildDays(List.of(a), daily, D1, D1.plusDays(1));

        EarlyWarning summary = ReplayService.summarize(days, daily, new EarlyWarningEpisodes(true,
                List.of(new MlServiceClient.Season("Mùa khô", D1, D1.plusDays(1))), Map.of()));

        assertThat(summary.opened()).isZero();
    }

    @Test
    void withoutMlResultsTheSummaryIsMarkedUnavailable() {
        EarlyWarning summary = ReplayService.summarize(List.of(), Map.of(),
                new EarlyWarningEpisodes(false, List.of(), Map.of()));

        assertThat(summary.available()).isFalse();
    }

    @Test
    void rejectsInvalidRanges() {
        ReplayService service = new ReplayService(mock(NamedParameterJdbcTemplate.class), mock(MlServiceClient.class));

        assertThatThrownBy(() -> service.replay(D1, D1.minusDays(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.replay(D1, D1.plusDays(ReplayService.MAX_DAYS)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
