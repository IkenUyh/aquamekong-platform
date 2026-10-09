package com.aquamekong.dto.report;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * DTO cho /api/v1/reports. Giá trị null = chưa có dữ liệu trong kỳ.
 */
public final class ReportDtos {

    private ReportDtos() {
    }

    /** Giá trị trung bình kỳ hiện tại và kỳ liền trước (cùng độ dài). */
    public record PeriodValue(Double current, Double previous) {
    }

    public record LevelCount(String level, String label, long count) {
    }

    public record Overview(
            int days,
            PeriodValue avgSalinity,
            PeriodValue avgWaterLevel,
            PeriodValue avgFlowRate,
            long stationsAboveThreshold,
            long totalStations,
            double salinityThreshold,
            List<LevelCount> levelDistribution) {
    }

    public record TrendPoint(LocalDate date, Double current, Double previous) {
    }

    public record TopStation(int rank, Long stationId, String name, String province, Double salinity, Double previous, Double diff) {
    }

    /**
     * Dữ liệu có về đúng hạn không.
     *
     * @param latestMeasurementAt số đo mới nhất của các trạm đang hoạt động, null = chưa có số nào
     * @param expectedDate        ngày mà lẽ ra đã phải có số đo (hôm qua, hoặc hôm kia khi chưa tới giờ hẹn)
     * @param stale               số đo mới nhất cũ hơn expectedDate
     * @param stationsReporting   số trạm đang hoạt động đã có số đo từ expectedDate
     */
    public record DataFreshness(OffsetDateTime latestMeasurementAt, LocalDate expectedDate, boolean stale,
                                long stationsReporting, long activeStations) {
    }
}
