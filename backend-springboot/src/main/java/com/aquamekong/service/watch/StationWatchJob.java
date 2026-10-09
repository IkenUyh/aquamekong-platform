package com.aquamekong.service.watch;

import com.aquamekong.dto.watch.WatchDtos.Outlook;
import com.aquamekong.entity.user.StationWatch;
import com.aquamekong.repository.user.StationWatchRepository;
import com.aquamekong.service.push.PushMessage;
import com.aquamekong.service.push.PushService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Mỗi sáng sau khi chạy dự báo (DailyForecastJob 07:30), so từng trạm theo dõi với ngưỡng của người theo dõi.
 * Chỉ báo khi kết quả đổi so với lần trước: bắt đầu vượt ngưỡng (để kịp trữ nước), hoặc đã xuống dưới ngưỡng
 * (có thể lấy nước). Mùa khô trạm vượt ngưỡng nhiều tuần liền, báo lặp mỗi ngày thì người dùng sẽ tắt thông báo.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StationWatchJob {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final StationWatchRepository watchRepository;
    private final StationWatchService watchService;
    private final PushService pushService;

    @Scheduled(cron = "${app.watch.check-cron:0 0 8 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void check() {
        Instant now = Instant.now();
        Map<Long, StationSnapshot> snapshots = new HashMap<>();
        List<StationWatch> changed = new ArrayList<>();
        for (StationWatch watch : watchRepository.findAllByOrderByStationIdAsc()) {
            StationSnapshot snapshot = snapshots.computeIfAbsent(watch.getStation().getId(), watchService::snapshot);
            Outlook outlook = StationWatchService.outlook(snapshot, watch.getThreshold(), now);
            if (outlook.exceeding() == watch.isForecastExceeding()) continue;
            pushService.notifyUser(watch.getUser().getId(), message(watch, outlook));
            watch.setForecastExceeding(outlook.exceeding());
            changed.add(watch);
        }
        watchRepository.saveAll(changed);
        log.info("Theo dõi trạm: {} lượt đổi trạng thái đã báo", changed.size());
    }

    static PushMessage message(StationWatch watch, Outlook outlook) {
        String station = watch.getStation().getName();
        String limit = number(watch.getThreshold()) + "‰" + (watch.getCrop() == null ? "" : " cho " + watch.getCrop().toLowerCase(Locale.ROOT));
        String tag = "watch-" + watch.getId();
        if (!outlook.exceeding()) {
            return new PushMessage("Độ mặn đã giảm: " + station,
                    "Số đo mới nhất và dự báo 7 ngày tới đều dưới ngưỡng " + limit + ", có thể lấy nước.", "/forecast", tag);
        }
        List<String> parts = new ArrayList<>();
        if (outlook.latestSalinity() != null && outlook.latestSalinity() > watch.getThreshold()) {
            parts.add("Độ mặn đo ngày " + DAY.format(outlook.latestAt().atZoneSameInstant(ZONE)) + " là "
                    + number(outlook.latestSalinity()) + "‰, vượt ngưỡng " + limit + ".");
        }
        if (outlook.firstExceedDate() != null) {
            parts.add("Dự báo vượt " + limit + " từ ngày " + DAY.format(outlook.firstExceedDate())
                    + ", cao nhất " + number(outlook.forecastMax()) + "‰. Nên trữ nước ngọt trước ngày này.");
        }
        return new PushMessage("Cảnh báo mặn: " + station, String.join(" ", parts), "/forecast", tag);
    }

    private static String number(double value) {
        return new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN"))).format(value);
    }
}
