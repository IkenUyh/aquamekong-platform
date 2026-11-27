package com.aquamekong.service;

import com.aquamekong.dto.RecommendationDto;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.repository.field.FieldProfileRepository;
import com.aquamekong.service.field.ActionPlan;
import com.aquamekong.service.field.FieldPlanService;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendationServiceTest {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");

    @Mock
    private MeasurementRepository measurementRepository;
    @Mock
    private SalinityForecastRepository forecastRepository;
    @Mock
    private FieldProfileRepository fieldRepository;
    @Mock
    private FieldPlanService fieldPlanService;
    @Mock
    private StationWatchService watchService;

    @InjectMocks
    private RecommendationService recommendationService;

    private long nextId = 1;

    @BeforeEach
    void noForecasts() {
        lenient().when(forecastRepository.findLatestRunForecastsBetween(any(), any())).thenReturn(List.of());
    }

    private Station station(String name) {
        return Station.builder().id(nextId++).name(name).build();
    }

    private static Measurement latest(Station station, String metric, double value) {
        return Measurement.builder().station(station).metricType(metric).value(value).recordedAt(OffsetDateTime.now()).build();
    }

    private static Measurement latest(String station, String metric, double value) {
        return latest(Station.builder().name(station).id((long) station.hashCode()).build(), metric, value);
    }

    private static SalinityForecast forecast(Station station, int daysAhead, double value, Double risk) {
        return SalinityForecast.builder().station(station).forecastDate(TODAY.plusDays(daysAhead))
                .predictedSalinity(value).riskSalinity(risk).build();
    }

    @Test
    void saltiestStationComesFirst() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(
            latest("Kinh 3000", "salinity", 7.28),
            latest("Tiểu Dừa", "salinity", 4.88),
            latest("Kim Quy", "salinity", 3.14),
            latest("Kênh Trường Sơn", "salinity", 16.16),
            latest("Kênh Trường Sơn", "water_level", 20.0)
        ));

        List<String> messages = recommendationService.getRecommendations().stream().map(RecommendationDto::getMessage).toList();

        assertThat(messages).containsExactly(
            "Hạn chế lấy nước tưới tại khu vực Kênh Trường Sơn (16,2‰)",
            "Hạn chế lấy nước tưới tại khu vực Kinh 3000 (7,3‰)",
            "Hạn chế lấy nước tưới tại khu vực Tiểu Dừa (4,9‰)",
            "Khuyến nghị kiểm tra hệ thống cống ngăn mặn ở hạ lưu."
        );
    }

    @Test
    void stationThatMayExceedSoonGetsAStoreWaterAdviceEarliestFirst() {
        Station kimQuy = station("Kim Quy");
        Station myTho = station("Mỹ Tho");
        Station calm = station("Vàm Kênh");
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(
            latest(kimQuy, "salinity", 3.1), latest(myTho, "salinity", 2.0), latest(calm, "salinity", 1.0)));
        when(forecastRepository.findLatestRunForecastsBetween(TODAY, TODAY.plusDays(7))).thenReturn(List.of(
            forecast(kimQuy, 1, 3.1, 3.8), forecast(kimQuy, 4, 3.1, 4.6), forecast(kimQuy, 5, 3.1, 5.2),
            forecast(myTho, 2, 2.0, 4.3),
            forecast(calm, 2, 1.0, 1.8)));

        List<RecommendationDto> result = recommendationService.getRecommendations();

        assertThat(result).extracting(RecommendationDto::getMessage).containsExactly(
            "Trữ nước ngọt trước ngày " + DAY.format(TODAY.plusDays(2)) + ": khu vực Mỹ Tho có thể vượt 4‰ (tới 4,3‰)",
            "Trữ nước ngọt trước ngày " + DAY.format(TODAY.plusDays(4)) + ": khu vực Kim Quy có thể vượt 4‰ (tới 5,2‰)",
            "Khuyến nghị kiểm tra hệ thống cống ngăn mặn ở hạ lưu."
        );
        assertThat(result.get(0).getPriority()).isEqualTo("MEDIUM");
    }

    @Test
    void staleReadingsAreIgnored() {
        Station old = station("Trạm cũ");
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(Measurement.builder()
            .station(old).metricType("salinity").value(9.0).recordedAt(OffsetDateTime.now().minusDays(5)).build()));

        assertThat(recommendationService.getRecommendations())
            .extracting(RecommendationDto::getType)
            .containsExactly("WATER_SAVING");
    }

    @Test
    void safeMessageWhenNoStationIsAboveThresholdOrAtRisk() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(latest("Kim Quy", "salinity", 3.14)));

        assertThat(recommendationService.getRecommendations())
            .extracting(RecommendationDto::getPriority)
            .containsExactly("LOW");
    }

    // ---- Khuyến nghị theo ruộng ----

    private static FieldProfile field(long id, String name, String crop) {
        return FieldProfile.builder().id(id).name(name).station(Station.builder().id(3L).build())
                .crop(Crop.builder().name(crop).category(Crop.Category.CROP).build()).build();
    }

    private static PlanAction action(String kind, String priority, int from, String message) {
        return new PlanAction(kind, priority, TODAY.plusDays(from), TODAY.plusDays(from), null, message, ActionPlan.WATER);
    }

    @Test
    void signedInUserWithFieldsGetsTheirFieldActionsInsteadOfTheGeneralList() {
        FieldProfile rice = field(1, "Ruộng A", "Lúa");
        FieldProfile coconut = field(2, "Vườn dừa", "Dừa");
        when(fieldRepository.findByUserUsernameOrderByCreatedAtAsc("alice")).thenReturn(List.of(rice, coconut));
        when(fieldPlanService.plan(eq(rice), any(), any(), any())).thenReturn(Optional.of(new FieldPlan("YELLOW", "h", List.of(
                action(ActionPlan.STORE, "HIGH", 1, "Trữ đầy ao trước hết ngày 15/11"),
                action(ActionPlan.MIX, "MEDIUM", 2, "Từ 16/11 tới 18/11 tưới pha 2/3 nước ao, 1/3 nước sông"),
                action(ActionPlan.TAKE_WATER, "LOW", 0, "Lấy nước được: 14/11–15/11")), null)));
        when(fieldPlanService.plan(eq(coconut), any(), any(), any())).thenReturn(Optional.of(new FieldPlan("RED", "h", List.of(
                action(ActionPlan.STOP_INTAKE, "HIGH", 0, "Từ 14/11 tới 20/11 không lấy nước sông tưới")), null)));

        List<RecommendationDto> result = recommendationService.getRecommendations("alice");

        assertThat(result).extracting(RecommendationDto::getMessage).containsExactly(
                "Ruộng A (lúa): Trữ đầy ao trước hết ngày 15/11",
                "Vườn dừa (dừa): Từ 14/11 tới 20/11 không lấy nước sông tưới",
                "Ruộng A (lúa): Từ 16/11 tới 18/11 tưới pha 2/3 nước ao, 1/3 nước sông",
                "Ruộng A (lúa): Lấy nước được: 14/11–15/11");
        assertThat(result).extracting(RecommendationDto::getType)
                .containsExactly("WATER_STORAGE", "IRRIGATION", "IRRIGATION", "WATER_SAVING");
        assertThat(result).noneMatch(r -> "DAM_CHECK".equals(r.getType()));
        assertThat(result.get(0).getFieldId()).isEqualTo(1L);
        assertThat(result.get(0).getFieldName()).isEqualTo("Ruộng A");
        assertThat(result.get(0).getFrom()).isEqualTo(TODAY.plusDays(1));
        // Khuyến nghị chung không cần tới
        verifyNoInteractions(measurementRepository);
    }

    @Test
    void signedInUserWithoutFieldsGetsTheGeneralList() {
        when(fieldRepository.findByUserUsernameOrderByCreatedAtAsc("bob")).thenReturn(List.of());
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(latest("Kim Quy", "salinity", 3.14)));

        assertThat(recommendationService.getRecommendations("bob")).extracting(RecommendationDto::getType)
                .containsExactly("WATER_SAVING");
        verify(fieldPlanService, never()).plan(any(FieldProfile.class), any(), any(), any());
    }

    @Test
    void fieldsWithoutAPlanFallBackToTheGeneralList() {
        FieldProfile noStation = field(1, "Ruộng B", "Lúa");
        when(fieldRepository.findByUserUsernameOrderByCreatedAtAsc("alice")).thenReturn(List.of(noStation));
        when(fieldPlanService.plan(eq(noStation), any(), any(), any())).thenReturn(Optional.empty());
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(latest("Kim Quy", "salinity", 5.0)));

        assertThat(recommendationService.getRecommendations("alice")).extracting(RecommendationDto::getType)
                .containsExactly("IRRIGATION", "DAM_CHECK");
    }

    @Test
    void guestGetsTheGeneralList() {
        when(measurementRepository.findLatestMeasurementPerStation()).thenReturn(List.of(latest("Kim Quy", "salinity", 5.0)));

        List<RecommendationDto> result = recommendationService.getRecommendations(null);

        assertThat(result).extracting(RecommendationDto::getType).containsExactly("IRRIGATION", "DAM_CHECK");
        assertThat(result.get(0).getFieldId()).isNull();
        verifyNoInteractions(fieldRepository, fieldPlanService);
    }
}
