package com.aquamekong.service.forecast;

import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.station.Station;
import com.aquamekong.repository.forecast.ForecastRunRepository;
import com.aquamekong.repository.station.StationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Chạy dự báo cho mọi trạm đang hoạt động mỗi sáng và lưu lại, để người chưa đăng nhập
 * (không được chạy mô hình) vẫn thấy dự báo của ngày hôm nay.
 * Khởi động lại sau giờ chạy mà hôm nay chưa có lượt dự báo nào thì chạy bù.
 */
@Slf4j
@Component
public class DailyForecastJob {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Mốc mặc định của trang Dự báo. ST-GNN chỉ dùng khi days_ahead <= 7, nên không chạy 14 ngày */
    static final int DAYS_AHEAD = 7;
    private static final String DISABLED = "-";

    private final ForecastService forecastService;
    private final StationRepository stationRepository;
    private final ForecastRunRepository forecastRunRepository;
    private final TaskScheduler taskScheduler;
    private final String cron;
    private final Duration startupDelay;

    public DailyForecastJob(ForecastService forecastService,
                            StationRepository stationRepository,
                            ForecastRunRepository forecastRunRepository,
                            TaskScheduler taskScheduler,
                            @Value("${app.forecast.daily-cron:0 30 7 * * *}") String cron,
                            @Value("${app.forecast.startup-delay:PT2M}") Duration startupDelay) {
        this.forecastService = forecastService;
        this.stationRepository = stationRepository;
        this.forecastRunRepository = forecastRunRepository;
        this.taskScheduler = taskScheduler;
        this.cron = cron;
        this.startupDelay = startupDelay;
    }

    @Scheduled(cron = "${app.forecast.daily-cron:0 30 7 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void runDaily() {
        int ok = 0;
        int failed = 0;
        for (Station station : stationRepository.findByStatus(StationStatus.ACTIVE)) {
            try {
                forecastService.predict(station.getId(), DAYS_AHEAD);
                ok++;
            } catch (RuntimeException e) {
                failed++;
                log.warn("Dự báo hằng ngày lỗi ở trạm {}: {}", station.getCode(), e.getMessage());
            }
        }
        log.info("Dự báo hằng ngày: {} trạm thành công, {} trạm lỗi", ok, failed);
    }

    /** Chờ ML service sẵn sàng rồi mới chạy bù, không chặn lúc khởi động */
    @EventListener(ApplicationReadyEvent.class)
    public void scheduleCatchUp() {
        if (DISABLED.equals(cron)) return;
        taskScheduler.schedule(this::catchUpIfNoRunToday, Instant.now().plus(startupDelay));
    }

    void catchUpIfNoRunToday() {
        if (forecastRunRepository.existsByRunAtAfter(LocalDate.now(ZONE).atStartOfDay(ZONE).toOffsetDateTime())) return;
        log.info("Hôm nay chưa có lượt dự báo nào, chạy bù");
        runDaily();
    }
}
