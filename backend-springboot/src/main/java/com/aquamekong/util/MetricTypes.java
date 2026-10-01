package com.aquamekong.util;

import java.util.Locale;

/**
 * metric_type luôn lưu dạng chữ thường (salinity, water_level, flow_rate...)
 * để so khớp rule cảnh báo, truy vấn và ML pipeline nhất quán. DB có CHECK constraint tương ứng (V5).
 */
public final class MetricTypes {

    private MetricTypes() {
    }

    public static String normalize(String metricType) {
        return metricType == null ? null : metricType.trim().toLowerCase(Locale.ROOT);
    }
}
