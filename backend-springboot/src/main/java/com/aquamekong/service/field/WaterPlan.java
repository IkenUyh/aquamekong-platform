package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos.Storage;
import com.aquamekong.dto.field.FieldDtos.WaterDay;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.entity.forecast.SalinityForecast;
import com.aquamekong.entity.telemetry.Measurement;
import com.aquamekong.service.crop.CropStages;
import com.aquamekong.service.crop.CropStages.CurrentStage;
import com.aquamekong.service.watch.StationWatchService;
import com.aquamekong.service.watch.StationWatchService.StationSnapshot;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Kế hoạch nước 7 ngày tới cho một ruộng, cùng quy tắc với {@link StationWatchService#outlook}: số đo cũ hơn 3 ngày
 * (trạm mất tín hiệu) thì bỏ cả dự báo; số đo và dự báo đều là độ mặn cao nhất trong ngày.
 * <p>
 * Ngưỡng tính theo giai đoạn cây của từng ngày, nên lúa vào làm đòng giữa tuần thì ngưỡng đổi đúng ngày đó.
 * Tỷ lệ pha: nước tưới = f phần nước ao (mặn P) + (1 − f) phần nước sông (mặn S) phải không quá ngưỡng T, nên
 * f = (S − T) / (S − P). Ngày RISK lấy mức có thể lên tới làm S, để không pha thiếu.
 * Lượng nước (FAO 56): cây cần mỗi ngày diện tích (ha) × 10 × Kc × ET₀ (mm/ngày) m³ (1 mm trên 1 ha = 10 m³).
 */
public final class WaterPlan {

    public static final String SAFE = "SAFE";
    public static final String RISK = "RISK";
    public static final String EXCEED = "EXCEED";
    public static final String UNKNOWN = "UNKNOWN";
    /** Độ mặn nước ao giả định (‰): chưa cho nhập, coi ao là nước ngọt */
    public static final double POND_SALINITY = 0.0;

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private WaterPlan() {
    }

    /** ET₀ của một tháng và nguồn của nó */
    public record Et0(double mmDay, String source) {
    }

    /** Hôm nay .. hôm nay + OUTLOOK_DAYS, mỗi ngày một trạng thái */
    public static List<WaterDay> days(StationSnapshot snapshot, Crop crop, LocalDate plantedOn, Integer varietyDays,
                                      Instant now) {
        LocalDate today = now.atZone(ZONE).toLocalDate();
        Measurement latest = snapshot.latest();
        boolean fresh = latest != null && latest.getValue() != null
                && !latest.getRecordedAt().toInstant().isBefore(now.minus(StationWatchService.MAX_MEASUREMENT_AGE));
        Map<LocalDate, SalinityForecast> byDate = new HashMap<>();
        if (fresh) {
            for (SalinityForecast f : snapshot.forecasts()) {
                if (f.getPredictedSalinity() == null) continue;
                byDate.merge(f.getForecastDate(), f,
                        (a, b) -> a.getPredictedSalinity() >= b.getPredictedSalinity() ? a : b);
            }
        }
        boolean aquaculture = crop.getCategory() == Crop.Category.AQUACULTURE;

        List<WaterDay> days = new ArrayList<>();
        for (int i = 0; i <= StationWatchService.OUTLOOK_DAYS; i++) {
            LocalDate date = today.plusDays(i);
            CropStage stage = stageOn(crop, plantedOn, varietyDays, date);
            Double max = stage == null ? null : stage.getMaxSalinity();
            Double min = stage == null ? null : stage.getMinSalinity();
            SalinityForecast forecast = byDate.get(date);
            Double salinity = forecast == null ? null : forecast.getPredictedSalinity();
            Double risk = forecast == null ? null : forecast.getRiskSalinity();
            boolean measured = false;
            // Hôm nay: số đo mới nhất cao hơn dự báo (hoặc chưa có dự báo) thì lấy số đo
            if (i == 0 && fresh && (salinity == null || latest.getValue() >= salinity)) {
                salinity = latest.getValue();
                measured = true;
            }
            String status = status(salinity, risk, max, min);
            Double fraction = aquaculture || UNKNOWN.equals(status) ? null
                    
                    // Không làm tròn: frontend làm tròn lên thành phân số đơn giản, 0,67 sẽ thành 3/4 thay vì 2/3
                    : mixFraction(risk == null ? salinity : Math.max(salinity, risk), max, POND_SALINITY);
            days.add(new WaterDay(date, status, round2(salinity), round2(risk), measured, max, min, fraction));
        }
        return days;
    }

    static String status(Double salinity, Double risk, Double max, Double min) {
        if (salinity == null || max == null) return UNKNOWN;
        if (salinity > max || (min != null && salinity < min)) return EXCEED;
        if (risk != null && risk > max) return RISK;
        return SAFE;
    }

    /**
     * Phần nước ao trong hỗn hợp để nước tưới vừa đúng ngưỡng.
     *
     * @return 0 khi nước sông không vượt ngưỡng; 1 khi phải tưới toàn nước ao (ao cũng không dưới ngưỡng)
     */
    public static double mixFraction(double river, double threshold, double pond) {
        if (river <= threshold) return 0;
        if (pond >= threshold) return 1;
        return Math.min(1, (river - threshold) / (river - pond));
    }

    /** m³ nước cây cần mỗi ngày: 1 mm trên 1 ha là 10 m³ */
    public static double dailyNeedM3(double areaHa, double kc, double et0MmDay) {
        return areaHa * 10 * kc * et0MmDay;
    }

    /**
     * Ao đủ cho bao nhiêu ngày mặn (EXCEED và RISK), tưới toàn nước ao hoặc pha theo tỷ lệ của từng ngày. Không tính
     * lấy thêm nước sông vào ao giữa các ngày mặn (ngày an toàn xen giữa), nên số ngày đủ là mức thấp.
     *
     * @return null khi không tính được: không phải cây trồng, chưa có diện tích, giai đoạn cây chưa có Kc, thiếu ET₀
     */
    public static Storage storage(List<WaterDay> days, Crop crop, LocalDate plantedOn, Integer varietyDays,
                                  Double areaHa, Double pondVolumeM3, Map<Integer, Et0> et0ByMonth) {
        if (crop.getCategory() != Crop.Category.CROP || areaHa == null || days.isEmpty()) return null;
        List<WaterDay> unsafe = days.stream().filter(WaterPlan::unsafe).toList();
        WaterDay reference = unsafe.isEmpty() ? days.get(0) : unsafe.get(0);

        CropStage refStage = stageOn(crop, plantedOn, varietyDays, reference.date());
        Et0 refEt0 = et0ByMonth.get(reference.date().getMonthValue());
        if (refStage == null || refStage.getKc() == null || refEt0 == null) return null;

        double volume = pondVolumeM3 == null ? 0 : pondVolumeM3;
        double pure = volume;
        double mixed = volume;
        int pondDays = 0;
        int mixDays = 0;
        boolean pureDry = false;
        boolean mixDry = false;
        double mixedTotal = 0;
        for (WaterDay day : unsafe) {
            CropStage stage = stageOn(crop, plantedOn, varietyDays, day.date());
            Et0 et0 = et0ByMonth.get(day.date().getMonthValue());
            if (stage == null || stage.getKc() == null || et0 == null) return null;
            double need = dailyNeedM3(areaHa, stage.getKc(), et0.mmDay());
            double fresh = need * (day.freshFraction() == null ? 1 : day.freshFraction());
            mixedTotal += fresh;
            if (!pureDry && pure >= need) {
                pure -= need;
                pondDays++;
            } else {
                pureDry = true;
            }
            if (!mixDry && mixed >= fresh) {
                mixed -= fresh;
                mixDays++;
            } else {
                mixDry = true;
            }
        }

        return new Storage(round1(dailyNeedM3(areaHa, refStage.getKc(), refEt0.mmDay())), refStage.getKc(),
                refEt0.mmDay(), refStage.getKcSource(), refEt0.source(), unsafe.size(), pondVolumeM3, pondDays, mixDays,
                fillBy(days), (long) Math.ceil(Math.max(0, mixedTotal - volume) - 1e-9));
    }

    /** Ngày an toàn cuối cùng trước ngày mặn đầu tiên: hạn chót lấy nước sông vào ao */
    static LocalDate fillBy(List<WaterDay> days) {
        LocalDate lastSafe = null;
        for (WaterDay day : days) {
            if (unsafe(day)) return lastSafe;
            if (SAFE.equals(day.status())) lastSafe = day.date();
        }
        return null;
    }

    private static boolean unsafe(WaterDay day) {
        return EXCEED.equals(day.status()) || RISK.equals(day.status());
    }

    private static CropStage stageOn(Crop crop, LocalDate plantedOn, Integer varietyDays, LocalDate day) {
        CurrentStage current = CropStages.current(crop.getStages(), plantedOn, varietyDays, day);
        return current == null ? null : current.stage();
    }

    private static Double round2(Double v) {
        return v == null ? null : Math.round(v * 100) / 100.0;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
