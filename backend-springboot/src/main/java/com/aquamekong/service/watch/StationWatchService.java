package com.aquamekong.service.watch;

import com.aquamekong.dto.watch.WatchDtos.Outlook;
import com.aquamekong.dto.watch.WatchDtos.WatchDto;
import com.aquamekong.dto.watch.WatchDtos.WatchRequest;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.entity.user.StationWatch;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.forecast.SalinityForecastRepository;
import com.aquamekong.repository.station.StationRepository;
import com.aquamekong.repository.telemetry.MeasurementRepository;
import com.aquamekong.repository.user.StationWatchRepository;
import com.aquamekong.repository.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

/**
 * Trạm người dùng theo dõi, với ngưỡng độ mặn riêng (thường theo loại cây). So ngưỡng với số đo mới nhất,
 * với dự báo và mức có thể lên tới (mô hình rủi ro) của 7 ngày tới; StationWatchJob báo khi kết quả so sánh đổi.
 * Cùng quy tắc với ml-service app/early_warning/episodes.py, nơi chấm điểm cảnh báo sớm trên các mùa khô cũ.
 */
@Service
@RequiredArgsConstructor
public class StationWatchService {

    static final int MAX_WATCHES_PER_USER = 20;
    /** Số đo cũ hơn mốc này (trạm mất tín hiệu) không dùng để so ngưỡng */
    static final Duration MAX_MEASUREMENT_AGE = Duration.ofDays(3);
    /** Chỉ xét dự báo tới hôm nay + ngần này ngày (lượt chạy tay 14 ngày cũng chỉ xét 7 ngày đầu) */
    static final int OUTLOOK_DAYS = 7;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final StationWatchRepository watchRepository;
    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final MeasurementRepository measurementRepository;
    private final SalinityForecastRepository forecastRepository;

    /** Số đo độ mặn mới nhất và dự báo của lượt chạy mới nhất của một trạm */
    public record StationSnapshot(Measurement latest, List<SalinityForecast> forecasts) {
    }

    @Transactional(readOnly = true)
    public List<WatchDto> list(String username) {
        User user = user(username);
        Instant now = Instant.now();
        return watchRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .map(w -> toDto(w, outlook(snapshot(w.getStation().getId()), w.getThreshold(), w.getRiskUntil(), now)))
                .toList();
    }

    /** Theo dõi trạm; đã theo dõi thì đổi ngưỡng và loại cây */
    @Transactional
    public WatchDto save(String username, WatchRequest request) {
        User user = user(username);
        Station station = stationRepository.findById(request.stationId())
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy trạm: " + request.stationId()));
        StationWatch watch = watchRepository.findByUserIdAndStationId(user.getId(), station.getId()).orElse(null);
        if (watch == null) {
            if (watchRepository.countByUserId(user.getId()) >= MAX_WATCHES_PER_USER) {
                throw new IllegalArgumentException("Chỉ theo dõi được tối đa " + MAX_WATCHES_PER_USER + " trạm");
            }
            watch = StationWatch.builder().user(user).station(station).build();
        }
        watch.setThreshold(request.threshold());
        watch.setCrop(request.crop() == null || request.crop().isBlank() ? null : request.crop().trim());
        // Ngưỡng có thể đã đổi: ngày giữ cảnh báo tính lại từ dự báo hiện tại
        Outlook outlook = outlook(snapshot(station.getId()), request.threshold(), null, Instant.now());
        // Đã thấy tình hình lúc lưu: job sáng mai chỉ báo khi nó đổi
        watch.setForecastExceeding(outlook.exceeding());
        watch.setRiskUntil(outlook.riskUntil());
        return toDto(watchRepository.save(watch), outlook);
    }

    /** Chỉ xoá trạm theo dõi của chính tài khoản; không có thì bỏ qua */
    @Transactional
    public void delete(String username, Long watchId) {
        User user = user(username);
        watchRepository.findById(watchId)
                .filter(w -> w.getUser().getId().equals(user.getId()))
                .ifPresent(watchRepository::delete);
    }

    public StationSnapshot snapshot(Long stationId) {
        return new StationSnapshot(
                measurementRepository.findLatestByStationIdAndMetricType(stationId, "salinity"),
                forecastRepository.findLatestRunByStationId(stationId));
    }

    /**
     * @param riskUntil ngày giữ cảnh báo nguy cơ đã lưu của người theo dõi (null = chưa có). Đã báo một ngày có thể vượt
     *                  thì giữ tới hết ngày đó dù lượt dự báo sau không còn thấy: mức rủi ro lên xuống từng ngày, không giữ
     *                  thì app báo "đã giảm" ngay trước khi mặn vượt thật.
     */
    static Outlook outlook(StationSnapshot snapshot, double threshold, LocalDate riskUntil, Instant now) {
        LocalDate today = now.atZone(ZONE).toLocalDate();
        LocalDate horizon = today.plusDays(OUTLOOK_DAYS);
        Measurement latest = snapshot.latest();
        boolean fresh = latest != null && latest.getValue() != null
                && !latest.getRecordedAt().toInstant().isBefore(now.minus(MAX_MEASUREMENT_AGE));
        List<SalinityForecast> upcoming = snapshot.forecasts().stream()
                .filter(f -> f.getPredictedSalinity() != null
                        && !f.getForecastDate().isBefore(today) && !f.getForecastDate().isAfter(horizon))
                .toList();
        LocalDate firstExceed = upcoming.stream()
                .filter(f -> f.getPredictedSalinity() > threshold)
                .map(SalinityForecast::getForecastDate)
                .min(LocalDate::compareTo).orElse(null);
        Double forecastMax = upcoming.stream().map(SalinityForecast::getPredictedSalinity)
                .max(Double::compareTo).orElse(null);

        List<LocalDate> riskDates = upcoming.stream()
                .filter(f -> f.getRiskSalinity() != null && f.getRiskSalinity() > threshold)
                .map(SalinityForecast::getForecastDate)
                .sorted()
                .toList();
        Double riskMax = upcoming.stream().map(SalinityForecast::getRiskSalinity).filter(Objects::nonNull)
                .max(Double::compareTo).orElse(null);
        LocalDate until = riskUntil != null && !riskUntil.isBefore(today) ? riskUntil : null;
        if (!riskDates.isEmpty()) {
            LocalDate last = riskDates.get(riskDates.size() - 1);
            until = until == null || last.isAfter(until) ? last : until;
        }

        boolean exceeding = (fresh && latest.getValue() > threshold) || firstExceed != null || until != null;
        return new Outlook(fresh ? latest.getValue() : null, fresh ? latest.getRecordedAt() : null,
                firstExceed, forecastMax, riskDates.isEmpty() ? null : riskDates.get(0), riskMax, until, exceeding);
    }

    private static WatchDto toDto(StationWatch watch, Outlook outlook) {
        return new WatchDto(watch.getId(), watch.getStation().getId(), watch.getStation().getName(),
                watch.getThreshold(), watch.getCrop(), outlook);
    }

    private User user(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy người dùng: " + username));
    }
}
