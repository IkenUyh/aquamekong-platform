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

    /** WARNED: cảnh báo sớm (mô hình rủi ro báo có thể vượt khi số đo còn dưới ngưỡng) */
    public enum EventType { OPENED, RESOLVED, WARNED }

    /**
     * OPENED/RESOLVED: value là độ mặn; OPENED có warnedDaysAhead = app đã cảnh báo sớm trước bao nhiêu ngày
     * (null = không báo trước). WARNED: value là mức có thể lên tới, expectedDate là ngày đầu tiên có thể vượt,
     * outcome HIT (vượt thật) | MISS (hết nguy cơ mà không vượt) | OPEN (chưa rõ), outcomeDate là ngày rõ kết quả.
     */
    public record Event(Long stationId, EventType type, double value, Integer warnedDaysAhead,
                        LocalDate expectedDate, String outcome, LocalDate outcomeDate) {

        public static Event measured(Long stationId, EventType type, double value) {
            return new Event(stationId, type, value, null, null, null, null);
        }
    }

    /**
     * salinity: độ mặn lớn nhất trong ngày của từng trạm, cùng thứ tự với Replay.stations (null = không có số đo).
     * aboveCount: số trạm có số đo vượt ngưỡng trong ngày; openCount: số cảnh báo đang mở cuối ngày;
     * warningCount: số trạm đang có cảnh báo sớm (chưa có số đo vượt) trong ngày.
     */
    public record Day(LocalDate date, List<Double> salinity, int aboveCount, int openCount, int warningCount,
                      List<Event> events) {
    }

    public record Season(String label, LocalDate from, LocalDate to) {
    }

    /**
     * Cảnh báo sớm trong giai đoạn, chỉ tính trong các mùa khô đã chạy lại mô hình rủi ro (seasons; mỗi mùa mô hình chỉ
     * học số đo trước mùa đó). opened: số lần trạm bắt đầu vượt ngưỡng (có số đo trước đó trong giai đoạn);
     * warnedAhead: số lần trong đó app đã cảnh báo sớm từ hôm trước trở về trước; warnings: số lần cảnh báo sớm,
     * hits/misses: vượt thật / hết nguy cơ mà không vượt. available = false khi ML service chưa có kết quả.
     */
    public record EarlyWarning(boolean available, List<Season> seasons, int opened, int warnedAhead,
                               Double medianLeadDays, int warnings, int hits, int misses) {
    }

    public record Replay(LocalDate from, LocalDate to, double defaultThreshold, List<Station> stations, List<Day> days,
                         EarlyWarning earlyWarning) {
    }
}
