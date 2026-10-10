package com.aquamekong.service.forecast;

import com.aquamekong.entity.enums.StationStatus;
import com.aquamekong.entity.forecast.ForecastRun;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.repository.forecast.ForecastRunRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Chạy dự báo cho mọi trạm đang hoạt động và lưu lại, để người chưa đăng nhập (không được chạy mô hình) vẫn thấy
 * dự báo trong ngày. Chạy khi có số đo mới, không theo giờ cố định: số liệu RYNAN về theo lịch GitHub Actions,
 * có hôm trễ vài giờ, và máy chủ có thể khởi động muộn. Mỗi 30 phút kiểm tra: hôm nay chưa có lượt nào, hoặc có
 * số đo nạp vào sau lượt trước thì chạy lại. Xong thì phát ForecastsRefreshedEvent (StationWatchJob báo người theo dõi).
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
    private final MeasurementRepository measurementRepository;
    private final TaskScheduler taskScheduler;
    private final ApplicationEventPublisher eventPublisher;
    private final String cron;
    private final Duration startupDelay;

    /** Lượt chạy gần nhất của job này; null = chưa biết (vừa khởi động), lấy lượt mới nhất trong DB */
    private volatile OffsetDateTime lastRefreshAt;
    private volatile boolean lastRefreshKnown;

    public DailyForecastJob(ForecastService forecastService,
                            StationRepository stationRepository,
                            ForecastRunRepository forecastRunRepository,
                            MeasurementRepository measurementRepository,
                            TaskScheduler taskScheduler,
                            ApplicationEventPublisher eventPublisher,
                            @Value("${app.forecast.refresh-cron:0 */30 6-22 * * *}") String cron,
                            @Value("${app.forecast.startup-delay:PT2M}") Duration startupDelay) {
        this.forecastService = forecastService;
        this.stationRepository = stationRepository;
        this.forecastRunRepository = forecastRunRepository;
        this.measurementRepository = measurementRepository;
        this.taskScheduler = taskScheduler;
        this.eventPublisher = eventPublisher;
        this.cron = cron;
        this.startupDelay = startupDelay;
    }

    @Scheduled(cron = "${app.forecast.refresh-cron:0 */30 6-22 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void refreshIfNeeded() {
        refreshIfNeeded(Instant.now());
    }

    void refreshIfNeeded(Instant now) {
        if (!lastRefreshKnown) {
            lastRefreshAt = forecastRunRepository.findFirstByOrderByRunAtDesc().map(ForecastRun::getRunAt).orElse(null);
            lastRefreshKnown = true;
        }
        OffsetDateTime startOfToday = now.atZone(ZONE).toLocalDate().atStartOfDay(ZONE).toOffsetDateTime();
        OffsetDateTime newestImport = newestImportAt();
        if (lastRefreshAt == null || lastRefreshAt.isBefore(startOfToday)) {
            log.info("Hôm nay chưa chạy dự báo, chạy cho mọi trạm");
        } else if (newestImport != null && newestImport.isAfter(lastRefreshAt)) {
            log.info("Có số đo mới nạp lúc {}, chạy lại dự báo", newestImport.atZoneSameInstant(ZONE).toLocalTime());
        } else {
            return;
        }
        // Lấy mốc trước khi chạy: số đo nạp trong lúc chạy sẽ được lượt sau bắt
        lastRefreshAt = OffsetDateTime.ofInstant(now, ZONE);
        runDaily();
    }

    void runDaily() {
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
        eventPublisher.publishEvent(new ForecastsRefreshedEvent(LocalDate.now(ZONE), ok, failed));
    }

    /** Lúc nạp số đo mới nhất (measurements.created_at của dòng có id lớn nhất, dùng khoá chính) */
    private OffsetDateTime newestImportAt() {
        Long maxId = measurementRepository.findMaxId();
        if (maxId == null || maxId == 0) return null;
        return measurementRepository.findById(maxId).map(Measurement::getCreatedAt).orElse(null);
    }

    /** Chờ ML service sẵn sàng rồi mới chạy bù, không chặn lúc khởi động */
    @EventListener(ApplicationReadyEvent.class)
    public void scheduleCatchUp() {
        if (DISABLED.equals(cron)) return;
        taskScheduler.schedule(this::refreshIfNeeded, Instant.now().plus(startupDelay));
    }
}
