package com.aquamekong.service.report;

import com.aquamekong.dto.report.ReportDtos.DataFreshness;
import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.Map;
import java.util.Set;
import java.util.function.BinaryOperator;
import java.util.stream.Collectors;

/**
 * Kiểm tra dữ liệu có về đúng hạn không. Số đo RYNAN theo ngày gắn mốc 00:00 giờ VN và về sáng hôm sau
 * (GitHub Actions → Drive → ml-service; lịch GitHub có thể trễ vài giờ), nên sau giờ hẹn (mặc định 12:00) phải có số đo của hôm qua.
 */
@Service
public class DataFreshnessService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final MeasurementRepository measurementRepository;
    private final StationRepository stationRepository;
    private final LocalTime expectedBy;

    @Autowired
    public DataFreshnessService(MeasurementRepository measurementRepository,
                                StationRepository stationRepository,
                                @Value("${app.freshness.expected-by:12:00}") String expectedBy) {
        this(measurementRepository, stationRepository, LocalTime.parse(expectedBy));
    }

    DataFreshnessService(MeasurementRepository measurementRepository, StationRepository stationRepository, LocalTime expectedBy) {
        this.measurementRepository = measurementRepository;
        this.stationRepository = stationRepository;
        this.expectedBy = expectedBy;
    }

    @Transactional(readOnly = true)
    public DataFreshness status() {
        return status(Instant.now());
    }

    DataFreshness status(Instant now) {
        ZonedDateTime local = now.atZone(ZONE);
        LocalDate expectedDate = local.toLocalDate().minusDays(local.toLocalTime().isBefore(expectedBy) ? 2 : 1);
        OffsetDateTime expectedFrom = expectedDate.atStartOfDay(ZONE).toOffsetDateTime();

        Set<Long> active = stationRepository.findByStatus(StationStatus.ACTIVE).stream()
                .map(Station::getId).collect(Collectors.toSet());
        // Số đo mới nhất của mỗi trạm đang hoạt động, gộp mọi chỉ số
        Map<Long, OffsetDateTime> newestByStation = measurementRepository.findLatestMeasurementPerStation().stream()
                .filter(m -> active.contains(m.getStation().getId()))
                .collect(Collectors.toMap(m -> m.getStation().getId(), Measurement::getRecordedAt,
                        BinaryOperator.maxBy(Comparator.naturalOrder())));

        OffsetDateTime latest = newestByStation.values().stream().max(Comparator.naturalOrder()).orElse(null);
        long reporting = newestByStation.values().stream().filter(t -> !t.isBefore(expectedFrom)).count();
        boolean stale = latest == null || latest.isBefore(expectedFrom);
        return new DataFreshness(latest, expectedDate, stale, reporting, active.size());
    }
}
