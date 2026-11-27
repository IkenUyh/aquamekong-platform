package com.aquamekong.service.watch;

import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.watch.WatchDtos.Outlook;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.service.crop.CropStages;
import com.aquamekong.service.field.ActionPlan;
import com.aquamekong.service.field.FieldPlanService;
import com.aquamekong.service.field.WaterPlan.Et0;
import com.aquamekong.service.crop.CropStages.CurrentStage;
import com.aquamekong.entity.user.StationWatch;
import com.aquamekong.repository.user.StationWatchRepository;
import com.aquamekong.service.forecast.ForecastsRefreshedEvent;
import com.aquamekong.service.push.PushMessage;
import com.aquamekong.service.push.PushService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Sau mỗi lượt dự báo (DailyForecastJob chạy khi có số đo mới), so từng trạm theo dõi với ngưỡng của người theo dõi.
 * Chỉ báo khi kết quả đổi so với lần trước: bắt đầu vượt ngưỡng hoặc có nguy cơ vượt (để kịp trữ nước), hoặc đã xuống
 * dưới ngưỡng và hết nguy cơ (có thể lấy nước). Mùa khô trạm vượt ngưỡng nhiều tuần liền, báo lặp mỗi ngày thì người
 * dùng sẽ tắt thông báo.
 * <p>
 * Theo dõi của ruộng còn so kế hoạch nước của ruộng ({@link ActionPlan#digest}): việc quan trọng đổi (trữ trước ngày
 * khác, pha tỷ lệ khác, ao cạn sớm hơn...) thì báo kế hoạch mới, thay cho thông báo vượt ngưỡng nếu cả hai cùng đổi.
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
    private final FieldPlanService fieldPlanService;

    @EventListener
    public void onForecastsRefreshed(ForecastsRefreshedEvent event) {
        try {
            check();
        } catch (RuntimeException e) {
            // Không để lỗi báo người theo dõi làm hỏng lượt dự báo vừa chạy xong
            log.error("So trạm theo dõi sau lượt dự báo thất bại: {}", e.getMessage(), e);
        }
    }

    public void check() {
        Instant now = Instant.now();
        Map<Long, StationSnapshot> snapshots = new HashMap<>();
        Function<Long, StationSnapshot> snapshot = id -> snapshots.computeIfAbsent(id, watchService::snapshot);
        Map<Integer, Et0> et0 = null;
        List<StationWatch> changed = new ArrayList<>();
        int reported = 0;
        int planReported = 0;
        LocalDate today = now.atZone(ZONE).toLocalDate();
        for (StationWatch watch : watchRepository.findAllByOrderByStationIdAsc()) {
            // Ruộng sang giai đoạn mới: đổi ngưỡng trước khi so, để báo ngay nếu với ngưỡng mới trạm ra ngoài ngưỡng
            boolean thresholdChanged = applyStageThreshold(watch, today);
            Outlook outlook = StationWatchService.outlook(snapshot.apply(watch.getStation().getId()), watch.getThreshold(),
                    watch.getMinThreshold(), watch.getRiskUntil(), now);
            boolean stateChanged = outlook.exceeding() != watch.isForecastExceeding();

            // Theo dõi của ruộng: kế hoạch nước của ruộng, dùng chung số liệu trạm đã đọc
            FieldPlan plan = null;
            String digest = null;
            if (watch.getFieldProfile() != null) {
                if (et0 == null) et0 = fieldPlanService.et0ByMonth();
                plan = fieldPlanService.plan(watch.getFieldProfile(), snapshot, et0, now).orElse(null);
                digest = plan == null ? null : ActionPlan.digest(plan.actions());
            }
            Set<String> planChanges = watch.getPlanDigest() == null || digest == null ? Set.of()
                    : ActionPlan.changes(watch.getPlanDigest(), digest, today);
            boolean digestStored = Objects.equals(digest, watch.getPlanDigest());

            if (!stateChanged && digestStored && Objects.equals(outlook.riskUntil(), watch.getRiskUntil())) {
                if (thresholdChanged) changed.add(watch);
                continue;
            }
            // Mỗi theo dõi tối đa một thông báo một lượt: kế hoạch đổi thì báo kế hoạch (đã nói cả chuyện vượt ngưỡng)
            if (!planChanges.isEmpty()) {
                pushService.notifyUser(watch.getUser().getId(), planMessage(watch, plan, planChanges, today));
                planReported++;
            } else if (stateChanged) {
                pushService.notifyUser(watch.getUser().getId(), message(watch, outlook));
                reported++;
            }
            watch.setForecastExceeding(outlook.exceeding());
            watch.setRiskUntil(outlook.riskUntil());
            watch.setPlanDigest(digest);
            changed.add(watch);
        }
        watchRepository.saveAll(changed);
        log.info("Theo dõi trạm: {} lượt đổi trạng thái, {} kế hoạch ruộng đổi đã báo", reported, planReported);
    }

    /**
     * "Kế hoạch nước đổi: Ruộng sau nhà" với tối đa 3 việc quan trọng, việc mới trước. Không còn việc nào (hết ngày mặn)
     * thì nói câu trả lời của kế hoạch.
     */
    static PushMessage planMessage(StationWatch watch, FieldPlan plan, Set<String> changes, LocalDate today) {
        List<PlanAction> important = plan.actions().stream().filter(ActionPlan::important).toList();
        List<PlanAction> ordered = new ArrayList<>(important.stream()
                .filter(a -> changes.contains(ActionPlan.normalizedKey(a, today))).toList());
        important.stream().filter(a -> !ordered.contains(a)).forEach(ordered::add);
        String body = ordered.isEmpty() ? plan.headline()
                : ordered.stream().limit(3).map(PlanAction::message).collect(Collectors.joining(". ")) + ".";
        return new PushMessage("Kế hoạch nước đổi: " + watch.getFieldProfile().getName(), body, "/fields",
                "watch-" + watch.getId());
    }

    /**
     * Theo dõi của hồ sơ ruộng: đặt ngưỡng theo giai đoạn cây hôm nay (vd. lúa hết mạ). Giữ trạng thái đã báo, để vòng
     * so sánh ngay sau đó báo nếu với ngưỡng mới trạm đổi trạng thái. Giai đoạn chưa có ngưỡng thì giữ ngưỡng cũ.
     *
     * @return ngưỡng đã đổi
     */
    static boolean applyStageThreshold(StationWatch watch, LocalDate today) {
        FieldProfile field = watch.getFieldProfile();
        if (field == null) return false;
        CurrentStage current = CropStages.current(field.getCrop().getStages(), field.getPlantedOn(), field.getVarietyDays(), today);
        if (current == null || current.stage().getMaxSalinity() == null) return false;
        Double max = current.stage().getMaxSalinity();
        Double min = current.stage().getMinSalinity();
        if (max.equals(watch.getThreshold()) && Objects.equals(min, watch.getMinThreshold())) return false;
        watch.setThreshold(max);
        watch.setMinThreshold(min);
        return true;
    }

    static PushMessage message(StationWatch watch, Outlook outlook) {
        String station = watch.getStation().getName();
        String forCrop = watch.getCrop() == null ? "" : " cho " + watch.getCrop().toLowerCase(Locale.ROOT);
        String limit = number(watch.getThreshold()) + "‰" + forCrop;
        String tag = "watch-" + watch.getId();
        Double min = watch.getMinThreshold();
        if (!outlook.exceeding()) {
            if (min != null) {
                return new PushMessage("Độ mặn đã ổn định: " + station,
                        "Số đo mới nhất và dự báo 7 ngày tới đều trong khoảng " + number(min) + "–" + limit + ".",
                        "/forecast", tag);
            }
            return new PushMessage("Độ mặn đã giảm: " + station,
                    "Số đo mới nhất và dự báo 7 ngày tới đều dưới ngưỡng " + limit + ", có thể lấy nước.", "/forecast", tag);
        }
        List<String> parts = new ArrayList<>();
        boolean measuredLow = min != null && outlook.latestSalinity() != null && outlook.latestSalinity() < min;
        boolean forecastLow = min != null && outlook.firstBelowDate() != null;
        if (measuredLow) {
            parts.add("Độ mặn đo ngày " + DAY.format(outlook.latestAt().atZoneSameInstant(ZONE)) + " là "
                    + number(outlook.latestSalinity()) + "‰, dưới mức tối thiểu " + number(min) + "‰" + forCrop + ".");
        }
        if (forecastLow) {
            parts.add("Dự báo xuống dưới " + number(min) + "‰ từ ngày " + DAY.format(outlook.firstBelowDate())
                    + ", thấp nhất " + number(outlook.forecastMin()) + "‰.");
        }
        boolean measured = outlook.latestSalinity() != null && outlook.latestSalinity() > watch.getThreshold();
        boolean high = measured || outlook.firstExceedDate() != null || outlook.firstRiskDate() != null
                || outlook.riskUntil() != null;
        if ((measuredLow || forecastLow) && !high) {
            return new PushMessage("Độ mặn thấp: " + station, String.join(" ", parts), "/forecast", tag);
        }
        if (measured) {
            parts.add("Độ mặn đo ngày " + DAY.format(outlook.latestAt().atZoneSameInstant(ZONE)) + " là "
                    + number(outlook.latestSalinity()) + "‰, vượt ngưỡng " + limit + ".");
        }
        if (outlook.firstExceedDate() != null) {
            parts.add("Dự báo vượt " + limit + " từ ngày " + DAY.format(outlook.firstExceedDate())
                    + ", cao nhất " + number(outlook.forecastMax()) + "‰. Nên trữ nước ngọt trước ngày này.");
        } else if (!measured && outlook.firstRiskDate() != null) {
            parts.add("Có thể vượt " + limit + " từ ngày " + DAY.format(outlook.firstRiskDate())
                    + " (có thể lên tới " + number(outlook.riskMax()) + "‰). Nên trữ nước ngọt trước ngày này.");
        }
        String title = measured || outlook.firstExceedDate() != null ? "Cảnh báo mặn: " : "Nguy cơ mặn: ";
        return new PushMessage(title + station, String.join(" ", parts), "/forecast", tag);
    }

    private static String number(double value) {
        return new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN"))).format(value);
    }
}
