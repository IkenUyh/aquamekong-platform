package com.aquamekong.dto.forecast;

import java.time.LocalDate;

/**
 * Một dự báo đã lưu đặt cạnh số đo thật của ngày đó.
 *
 * @param issuedOn  ngày chạy dự báo (giờ VN)
 * @param leadDays  dự báo trước bao nhiêu ngày (forecastDate - issuedOn)
 * @param actual    độ mặn cao nhất đo được trong ngày forecastDate
 */
public record VerificationPointDto(LocalDate forecastDate, LocalDate issuedOn, int leadDays,
                                   double predicted, double actual, String modelVersion) {
}
