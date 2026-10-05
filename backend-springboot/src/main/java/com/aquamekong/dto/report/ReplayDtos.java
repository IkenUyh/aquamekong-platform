package com.aquamekong.dto.report;

import java.time.LocalDate;
import java.util.List;

/**
 * DTO cho /api/v1/reports/replay: phát lại diễn biến độ mặn theo ngày từ dữ liệu lịch sử.
 * Cảnh báo ở đây được tính lại theo ngưỡng rule hiện tại, không ghi vào bảng alerts.
 */
public final class ReplayDtos {

    private ReplayDtos() {
    }

    /** Khoảng ngày có dữ liệu độ mặn (null nếu chưa có) */
    public record Bounds(LocalDate minDate, LocalDate maxDate) {
    }

    /** threshold: ngưỡng rule cảnh báo độ mặn của trạm, hoặc ngưỡng chung nếu trạm chưa có rule */
    public record Station(Long id, String code, String name, double latitude, double longitude, double threshold) {
    }

    public enum EventType { OPENED, RESOLVED }

    public record Event(Long stationId, EventType type, double value) {
    }

    /**
     * salinity: độ mặn lớn nhất trong ngày của từng trạm, cùng thứ tự với Replay.stations (null = không có số đo).
     * aboveCount: số trạm có số đo vượt ngưỡng trong ngày; openCount: số cảnh báo đang mở cuối ngày.
     */
    public record Day(LocalDate date, List<Double> salinity, int aboveCount, int openCount, List<Event> events) {
    }

    public record Replay(LocalDate from, LocalDate to, double defaultThreshold, List<Station> stations, List<Day> days) {
    }
}
