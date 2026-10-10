package com.aquamekong.service.forecast;

import java.time.LocalDate;

/** DailyForecastJob chạy xong một lượt dự báo cho mọi trạm; StationWatchJob so lại các trạm theo dõi. */
public record ForecastsRefreshedEvent(LocalDate day, int succeeded, int failed) {
}
