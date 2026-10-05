package com.aquamekong.service.push;

import com.aquamekong.entity.enums.AlertSeverity;

/** Phát ra khi AlertService tạo một cảnh báo mới; PushService gửi thông báo sau khi transaction commit. */
public record AlertCreatedEvent(Long alertId, String stationName, String metricType, String operator,
                                double value, double threshold, AlertSeverity severity) {
}
