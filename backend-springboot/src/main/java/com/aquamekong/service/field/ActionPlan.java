package com.aquamekong.service.field;

import com.aquamekong.dto.field.FieldDtos;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.dto.field.FieldDtos.PlanAction;
import com.aquamekong.dto.field.FieldDtos.Storage;
import com.aquamekong.dto.field.FieldDtos.WaterDay;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.service.crop.CropStages;
import com.aquamekong.service.crop.CropStages.CurrentStage;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;

/**
 * Biến kế hoạch nước 7 ngày ({@link FieldDtos.WaterPlan}) của một ruộng thành việc cần làm có ngày: trữ nước trước ngày mặn, pha
 * nước ao, ngừng lấy nước sông, đo mặn tại cống, ao sắp cạn, giai đoạn cây đổi ngưỡng, ngày lấy được nước. Kèm một câu
 * trả lời ngắn cho "Tuần này lấy nước được không?" (verdict) để chế độ nông dân dùng.
 * <p>
 * Tỷ lệ pha làm tròn LÊN thành phân số đơn giản như frontend {@code utils/waterPlan.ts} (1/4, 1/3, 1/2, 2/3, 3/4; trên
 * 3/4 thì chỉ tưới nước ao), để việc cần làm và khối kế hoạch nước nói cùng một tỷ lệ.
 */
public final class ActionPlan {

    public static final String STORE = "STORE";
    public static final String MIX = "MIX";
    public static final String POND_ONLY = "POND_ONLY";
    public static final String STOP_INTAKE = "STOP_INTAKE";
    public static final String CHECK = "CHECK";
    public static final String POND_EMPTY = "POND_EMPTY";
    public static final String STAGE_CHANGE = "STAGE_CHANGE";
    public static final String TAKE_WATER = "TAKE_WATER";

    public static final String HIGH = "HIGH";
    public static final String MEDIUM = "MEDIUM";
    public static final String LOW = "LOW";

    public static final String RED = "RED";
    public static final String YELLOW = "YELLOW";
    public static final String GREEN = "GREEN";
    public static final String GREY = "GREY";

    /** Nguồn của các việc lập từ kế hoạch nước */
    public static final String WATER = "WATER";

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");
    private static final Locale VI = Locale.forLanguageTag("vi-VN");

    private ActionPlan() {
    }

    /** Phần nước ao a/b. 1/1 = chỉ tưới nước ao. */
    record Mix(int pond, int parts) {
        double value() {
            return (double) pond / parts;
        }

        boolean pondOnly() {
            return pond == parts;
        }

        String label() {
            return pondOnly() ? "1" : pond + "/" + parts;
        }
    }

    private static final List<Mix> MIXES = List.of(new Mix(1, 4), new Mix(1, 3), new Mix(1, 2), new Mix(2, 3), new Mix(3, 4));

    /** Làm tròn lên; null khi không cần pha (0 hoặc không biết), 1/1 khi trên 3/4 */
    static Mix roundUp(Double fraction) {
        if (fraction == null || fraction <= 0) return null;
        for (Mix m : MIXES) {
            if (fraction <= m.value() + 1e-9) return m;
        }
        return new Mix(1, 1);
    }

    /** Việc cần làm từ kế hoạch nước, chưa sắp xếp. Trạm mất tín hiệu: chỉ một việc đo mặn trước khi lấy nước. */
    public static List<PlanAction> waterActions(FieldProfile field, FieldDtos.WaterPlan plan, LocalDate today) {
        List<WaterDay> days = plan.days();
        List<PlanAction> out = new ArrayList<>();
        if (days.isEmpty() || days.stream().allMatch(ActionPlan::unknown)) {
            out.add(action(CHECK, MEDIUM, today, today, null,
                    "Trạm mất tín hiệu hoặc chưa có dự báo: đo mặn tại cống trước khi lấy nước"));
            return out;
        }
        boolean aquaculture = field.getCrop().getCategory() == Crop.Category.AQUACULTURE;
        boolean pond = field.isHasPond();
        Storage storage = plan.storage();

        // Trữ nước: còn ngày an toàn trước ngày mặn đầu tiên
        LocalDate fillBy = WaterPlan.fillBy(days);
        if (fillBy != null) {
            long extra = storage == null ? 0 : storage.extraNeededM3();
            String message;
            if (aquaculture) {
                message = "Lấy đủ nước vào ao nuôi trước hết ngày " + day(fillBy);
            } else if (pond) {
                message = "Trữ đầy ao trước hết ngày " + day(fillBy) + (extra > 0 ? ", cần thêm khoảng " + m3(extra) : "");
            } else {
                message = "Trữ nước ngọt (bồn, kênh nội đồng) trước hết ngày " + day(fillBy)
                        + (extra > 0 ? ", khoảng " + m3(extra) + " để pha tưới" : "");
            }
            out.add(action(STORE, HIGH, fillBy, fillBy, null, message));
        }

        if (aquaculture) {
            for (List<WaterDay> run : runs(days, d -> WaterPlan.EXCEED.equals(d.status()), d -> "")) {
                WaterDay first = run.get(0);
                String range = first.minThreshold() == null ? "ngưỡng " + number(first.threshold()) + "‰"
                        : "khoảng " + number(first.minThreshold()) + "–" + number(first.threshold()) + "‰";
                out.add(action(STOP_INTAKE, HIGH, first.date(), last(run).date(), null,
                        capitalize(span(run)) + " không lấy nước sông vào ao nuôi: độ mặn ngoài " + range));
            }
        } else if (pond) {
            // Ngày mặn liền nhau cùng tỷ lệ pha (đã làm tròn) gộp thành một việc
            for (List<WaterDay> run : runs(days, d -> unsafe(d) && roundUp(d.freshFraction()) != null,
                    d -> roundUp(d.freshFraction()).label())) {
                Mix mix = roundUp(run.get(0).freshFraction());
                LocalDate from = run.get(0).date();
                if (mix.pondOnly()) {
                    out.add(action(POND_ONLY, HIGH, from, last(run).date(), 1.0,
                            capitalize(span(run)) + " chỉ tưới nước ao, không pha nước sông"));
                } else {
                    out.add(action(MIX, MEDIUM, from, last(run).date(), mix.value(),
                            capitalize(span(run)) + " tưới pha " + mix.label() + " nước ao, "
                                    + (mix.parts() - mix.pond()) + "/" + mix.parts() + " nước sông"));
                }
            }
        } else {
            for (List<WaterDay> run : runs(days, d -> WaterPlan.EXCEED.equals(d.status()), d -> "")) {
                double peak = run.stream().mapToDouble(d -> d.salinity() == null ? 0 : d.salinity()).max().orElse(0);
                double threshold = run.stream().mapToDouble(WaterDay::threshold).min().orElse(0);
                out.add(action(STOP_INTAKE, HIGH, run.get(0).date(), last(run).date(), null,
                        capitalize(span(run)) + " không lấy nước sông tưới: mặn tới " + number(peak) + "‰, ngưỡng "
                                + number(threshold) + "‰"));
            }
        }

        // Ngày có thể mặn: đo trước khi lấy
        for (List<WaterDay> run : runs(days, d -> WaterPlan.RISK.equals(d.status()), d -> "")) {
            double peak = run.stream().mapToDouble(d -> d.riskSalinity() == null ? 0 : d.riskSalinity()).max().orElse(0);
            out.add(action(CHECK, MEDIUM, run.get(0).date(), last(run).date(), null,
                    capitalize(span(run)) + " nước sông có thể vượt ngưỡng (có thể lên tới " + number(peak)
                            + "‰), nên đo mặn tại cống trước khi lấy"));
        }

        // Ao cạn trước khi hết ngày mặn, kể cả khi pha
        if (pond && !aquaculture && storage != null && storage.pondVolumeM3() != null
                && storage.pondDaysWithMix() < storage.unsafeDays()) {
            List<WaterDay> unsafe = days.stream().filter(ActionPlan::unsafe).toList();
            if (storage.pondDaysWithMix() < unsafe.size()) {
                LocalDate dry = unsafe.get(storage.pondDaysWithMix()).date();
                out.add(action(POND_EMPTY, HIGH, dry, dry, null, "Ao có thể cạn khoảng ngày " + day(dry)
                        + " (pha đúng tỷ lệ thì đủ " + storage.pondDaysWithMix() + " trong " + storage.unsafeDays()
                        + " ngày mặn)"));
            }
        }

        // Giai đoạn cây đổi sang ngưỡng chặt hơn trong tuần
        for (int i = 1; i < days.size(); i++) {
            Double before = days.get(i - 1).threshold();
            Double now = days.get(i).threshold();
            if (before == null || now == null || now >= before) continue;
            LocalDate date = days.get(i).date();
            CurrentStage stage = CropStages.current(field.getCrop().getStages(), field.getPlantedOn(), field.getVarietyDays(), date);
            String stageName = stage == null ? "giai đoạn mới" : "giai đoạn " + stage.stage().getName().toLowerCase(VI);
            out.add(action(STAGE_CHANGE, MEDIUM, date, date, null, "Từ " + day(date) + " "
                    + field.getCrop().getName().toLowerCase(VI) + " vào " + stageName + ", ngưỡng còn " + number(now) + "‰"));
        }

        // Ngày lấy được nước, một dòng
        List<List<WaterDay>> safe = runs(days, d -> WaterPlan.SAFE.equals(d.status()), d -> "");
        if (!safe.isEmpty()) {
            List<String> parts = safe.stream().map(r -> r.size() == 1 ? day(r.get(0).date())
                    : day(r.get(0).date()) + "–" + day(last(r).date())).toList();
            out.add(action(TAKE_WATER, LOW, safe.get(0).get(0).date(), last(last(safe)).date(), null,
                    (aquaculture ? "Lấy nước vào ao nuôi được: " : "Lấy nước được: ") + String.join(", ", parts)));
        }
        return out;
    }

    /** Ghép việc của mọi nguồn thành kế hoạch: theo ngày, việc gấp trước cùng ngày, "Lấy nước được" để cuối */
    public static FieldPlan plan(FieldProfile field, FieldDtos.WaterPlan water, List<PlanAction> actions) {
        boolean aquaculture = field.getCrop().getCategory() == Crop.Category.AQUACULTURE;
        List<PlanAction> sorted = actions.stream().sorted(ORDER).toList();
        String verdict = verdict(water);
        return new FieldPlan(verdict, headline(verdict, water, aquaculture), sorted, water);
    }

    static final Comparator<PlanAction> ORDER = Comparator
            .comparing((PlanAction a) -> TAKE_WATER.equals(a.kind()))
            .thenComparing(PlanAction::from, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparingInt(a -> rank(a.priority()))
            .thenComparingInt(a -> kindRank(a.kind()));

    private static final List<String> KIND_ORDER = List.of(STORE, STOP_INTAKE, POND_ONLY, MIX, CHECK, POND_EMPTY, STAGE_CHANGE);

    /** Cùng ngày, cùng mức: thứ tự cố định để kế hoạch (và dấu vân tay) không đổi theo thứ tự các nguồn */
    private static int kindRank(String kind) {
        int i = KIND_ORDER.indexOf(kind);
        return i < 0 ? KIND_ORDER.size() : i;
    }

    static int rank(String priority) {
        return switch (priority == null ? "" : priority) {
            case HIGH -> 0;
            case MEDIUM -> 1;
            default -> 2;
        };
    }

    /** RED: hôm nay vượt; YELLOW: hôm nay chưa vượt nhưng tuần này có ngày mặn; GREEN: cả tuần an toàn; GREY: chưa biết hôm nay */
    public static String verdict(FieldDtos.WaterPlan plan) {
        List<WaterDay> days = plan.days();
        if (days.isEmpty() || unknown(days.get(0))) return GREY;
        if (WaterPlan.EXCEED.equals(days.get(0).status())) return RED;
        if (days.stream().anyMatch(ActionPlan::unsafe)) return YELLOW;
        return GREEN;
    }

    /** Trả lời "Tuần này lấy nước được không?" trong một câu */
    public static String headline(String verdict, FieldDtos.WaterPlan plan, boolean aquaculture) {
        List<WaterDay> days = plan.days();
        String water = aquaculture ? "độ mặn ở trạm" : "nước sông";
        switch (verdict) {
            case GREY:
                return "Chưa biết: trạm mất tín hiệu hoặc chưa có dự báo, đo mặn tại cống trước khi lấy nước.";
            case RED: {
                String now = aquaculture ? "Không, hôm nay độ mặn ở trạm ngoài khoảng nuôi" : "Không, hôm nay nước sông mặn hơn ngưỡng";
                LocalDate back = days.stream().skip(1)
                        .filter(d -> WaterPlan.SAFE.equals(d.status()))
                        .map(WaterDay::date).findFirst().orElse(null);
                return now + (back == null ? ", chưa thấy ngày lấy lại được trong 7 ngày tới." : "; có thể lấy lại từ " + day(back) + ".");
            }
            case YELLOW: {
                WaterDay first = days.stream().filter(ActionPlan::unsafe).findFirst().orElseThrow();
                String what = WaterPlan.EXCEED.equals(first.status())
                        ? (aquaculture ? " ra ngoài khoảng nuôi" : " mặn") : " có thể vượt ngưỡng";
                if (!WaterPlan.SAFE.equals(days.get(0).status())) {
                    return "Cẩn thận: hôm nay " + water + " có thể vượt ngưỡng, đo mặn tại cống trước khi lấy.";
                }
                LocalDate fillBy = WaterPlan.fillBy(days);
                return "Có, tới hết ngày " + day(fillBy) + "; từ " + day(first.date()) + " " + water + what + ".";
            }
            default: {
                long unknown = days.stream().filter(ActionPlan::unknown).count();
                String tail = unknown > 0 ? " (" + unknown + " ngày chưa có dự báo)" : "";
                return aquaculture ? "Có, cả tuần độ mặn ở trạm trong khoảng nuôi" + tail + "."
                        : "Có, cả tuần nước sông trong ngưỡng" + tail + ".";
            }
        }
    }

    // ---- Dấu vân tay của kế hoạch, để chỉ báo đẩy khi kế hoạch thật sự đổi ----

    /**
     * Các việc quan trọng của kế hoạch nước (bỏ "Lấy nước được" và mọi số ‰), mỗi việc "KIND:từ:tới:tỷ lệ", sắp xếp,
     * nối bằng "|". Lưu ở {@code station_watches.plan_digest}.
     */
    public static String digest(List<PlanAction> actions) {
        Set<String> keys = new TreeSet<>();
        for (PlanAction a : actions) {
            if (!important(a)) continue;
            keys.add(a.kind() + ":" + a.from() + ":" + a.until() + ":" + fractionLabel(a.fraction()));
        }
        return String.join("|", keys);
    }

    /**
     * So hai dấu vân tay mà không báo chỉ vì cửa sổ 7 ngày trượt: việc đã qua (tới trước hôm nay) bỏ đi, việc đã bắt
     * đầu (từ hôm nay trở về trước) coi như cùng một ngày bắt đầu, và ngày cuối không đem so (cửa sổ dài thêm mỗi ngày).
     *
     * @return các việc mới (khoá đã chuẩn hoá) so với lần trước; rỗng = kế hoạch không đổi
     */
    public static Set<String> changes(String previous, String current, LocalDate today) {
        Set<String> before = normalized(previous, today);
        Set<String> now = normalized(current, today);
        if (before.equals(now)) return Set.of();
        Set<String> added = new LinkedHashSet<>(now);
        added.removeAll(before);
        // Chỉ có việc bị bỏ (vd. hết ngày mặn sớm hơn): vẫn là kế hoạch đổi
        return added.isEmpty() ? Set.of("") : added;
    }

    /** Khoá đã chuẩn hoá của một việc, như {@link #changes} dùng */
    public static String normalizedKey(PlanAction a, LocalDate today) {
        return a.kind() + ":" + (a.from() == null || !a.from().isAfter(today) ? "-" : a.from().toString()) + ":"
                + fractionLabel(a.fraction());
    }

    public static boolean important(PlanAction a) {
        return WATER.equals(a.source()) && !TAKE_WATER.equals(a.kind());
    }

    private static Set<String> normalized(String digest, LocalDate today) {
        Set<String> out = new TreeSet<>();
        if (digest == null || digest.isEmpty()) return out;
        for (String key : digest.split("\\|")) {
            String[] p = key.split(":", -1);
            if (p.length < 4) continue;
            LocalDate from = p[1].equals("null") ? null : LocalDate.parse(p[1]);
            LocalDate until = p[2].equals("null") ? null : LocalDate.parse(p[2]);
            if (until != null && until.isBefore(today)) continue;
            out.add(p[0] + ":" + (from == null || !from.isAfter(today) ? "-" : from.toString()) + ":" + p[3]);
        }
        return out;
    }

    private static String fractionLabel(Double fraction) {
        if (fraction == null) return "";
        Mix mix = roundUp(fraction);
        return mix == null ? "" : mix.label();
    }

    // ---- Tiện ích ----

    /** Các đoạn ngày liền nhau thoả điều kiện và cùng khoá */
    private static List<List<WaterDay>> runs(List<WaterDay> days, Predicate<WaterDay> keep,
                                             java.util.function.Function<WaterDay, String> key) {
        List<List<WaterDay>> runs = new ArrayList<>();
        List<WaterDay> current = null;
        String currentKey = null;
        for (WaterDay d : days) {
            if (!keep.test(d)) {
                current = null;
                continue;
            }
            String k = key.apply(d);
            if (current == null || !Objects.equals(k, currentKey)) {
                current = new ArrayList<>();
                runs.add(current);
                currentKey = k;
            }
            current.add(d);
        }
        return runs;
    }

    private static <T> T last(List<T> list) {
        return list.get(list.size() - 1);
    }

    /** "ngày 17/11" hoặc "từ 17/11 tới 19/11" */
    private static String span(List<WaterDay> run) {
        return run.size() == 1 ? "ngày " + day(run.get(0).date())
                : "từ " + day(run.get(0).date()) + " tới " + day(last(run).date());
    }

    static boolean unsafe(WaterDay d) {
        return WaterPlan.EXCEED.equals(d.status())
                || WaterPlan.RISK.equals(d.status());
    }

    private static PlanAction action(String kind, String priority, LocalDate from, LocalDate until, Double fraction,
                                     String message) {
        return new PlanAction(kind, priority, from, until, fraction, message, WATER);
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String day(LocalDate date) {
        return DAY.format(date);
    }

    private static String m3(long v) {
        return new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(VI)).format(v) + " m³";
    }

    private static String number(double value) {
        return new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(VI)).format(value);
    }

    private static boolean unknown(WaterDay d) {
        return WaterPlan.UNKNOWN.equals(d.status());
    }
}
