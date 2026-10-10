package com.aquamekong.service.report;

import com.aquamekong.dto.report.ReportDtos.DataFreshness;
import com.aquamekong.service.push.PushMessage;
import com.aquamekong.service.push.PushService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Mỗi sáng sau giờ hẹn, nếu chưa có số đo của hôm qua thì báo cho Quản trị và Vận hành. Dữ liệu đi qua nhiều khâu
 * (RYNAN, GitHub Actions, Google Drive, ml-service), khâu nào hỏng thì số đo đứng yên mà không ai hay.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataFreshnessJob {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final DataFreshnessService freshnessService;
    private final PushService pushService;

    @Scheduled(cron = "${app.freshness.check-cron:0 0 12 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void check() {
        DataFreshness status = freshnessService.status();
        if (!status.stale()) return;
        PushMessage message = message(status);
        log.warn("Dữ liệu trễ: {}", message.body());
        int sent = pushService.notifyStaff(message);
        log.info("Đã báo dữ liệu trễ tới {} thiết bị của Quản trị/Vận hành", sent);
    }

    static PushMessage message(DataFreshness status) {
        String latest = status.latestMeasurementAt() == null
                ? "hệ thống chưa có số đo nào"
                : "số đo mới nhất là ngày " + DAY.format(status.latestMeasurementAt().atZoneSameInstant(ZONE));
        String body = "Chưa có số đo ngày " + DAY.format(status.expectedDate()) + ", " + latest
                + ". Kiểm tra workflow RYNAN daily fetch, folder Drive và ml-service.";
        return new PushMessage("Dữ liệu chưa về", body, "/", "data-freshness");
    }
}
