package com.aquamekong.service.report;

import com.aquamekong.dto.report.ReplayDtos.Day;
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
        assertThat(days.get(0).events()).containsExactly(new Event(2L, EventType.OPENED, 2.5));
        assertThat(days.get(1).events()).containsExactly(new Event(1L, EventType.OPENED, 5.0));
        assertThat(days.get(2).events()).containsExactly(new Event(2L, EventType.RESOLVED, 1.0));
        assertThat(days.get(3).events()).containsExactly(new Event(1L, EventType.RESOLVED, 3.5));
        assertThat(days.get(2).salinity()).isEqualTo(Arrays.asList(null, 1.0));
    }

    @Test
    void rejectsInvalidRanges() {
        ReplayService service = new ReplayService(mock(NamedParameterJdbcTemplate.class));

        assertThatThrownBy(() -> service.replay(D1, D1.minusDays(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.replay(D1, D1.plusDays(ReplayService.MAX_DAYS)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
