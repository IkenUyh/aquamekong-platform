package com.aquamekong.service.push;

import com.aquamekong.dto.push.PushConfigDto;
import com.aquamekong.dto.push.PushSubscribeRequest;
import com.aquamekong.entity.enums.AlertSeverity;
import com.aquamekong.entity.user.PushSubscription;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.user.PushSubscriptionRepository;
import com.aquamekong.repository.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.net.URI;
import java.net.URISyntaxException;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Thông báo đẩy khi có cảnh báo mới: Web Push cho trình duyệt, FCM cho app điện thoại.
 * Cảnh báo mới gửi tới tài khoản theo dõi trạm đó, tài khoản chưa theo dõi trạm nào, và Quản trị/Vận hành.
 * Thông báo vận hành (vd. dữ liệu trễ) chỉ gửi cho Quản trị và Vận hành.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {

    static final int MAX_DEVICES_PER_USER = 20;
    static final List<String> STAFF_ROLES = List.of("ROLE_ADMIN", "ROLE_OPERATOR");

    /**
     * Backend tự gửi POST tới endpoint do client khai báo -> chỉ chấp nhận dịch vụ push thật của trình duyệt,
     * không để endpoint trỏ vào mạng nội bộ (SSRF).
     */
    static final List<String> WEB_PUSH_HOSTS = List.of(
            "fcm.googleapis.com",          // Chrome, Edge (Chromium), Opera, Samsung Internet
            "push.services.mozilla.com",   // Firefox
            "notify.windows.com",          // Edge cũ
            "push.apple.com");             // Safari
    private static final Pattern FCM_TOKEN = Pattern.compile("[A-Za-z0-9_:\\-]{20,1000}");

    private static final Map<String, String[]> METRIC_LABELS = Map.of(
            "salinity", new String[]{"Độ mặn", "‰"},
            "water_level", new String[]{"Mực nước", " m"},
            "flow_rate", new String[]{"Lưu lượng", " m³/s"});

    private final PushSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final WebPushSender webPushSender;
    private final FcmSender fcmSender;
    private final ObjectMapper objectMapper;

    public PushConfigDto config() {
        return new PushConfigDto(webPushSender.getPublicKey(), fcmSender.isEnabled());
    }

    @Transactional
    public void subscribe(String username, PushSubscribeRequest request) {
        validate(request);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy người dùng: " + username));
        // Cùng endpoint = cùng thiết bị: cập nhật (vd. đăng nhập tài khoản khác trên máy đó)
        PushSubscription subscription = subscriptionRepository.findByEndpoint(request.endpoint()).orElse(null);
        if (subscription == null) {
            if (subscriptionRepository.countByUserId(user.getId()) >= MAX_DEVICES_PER_USER) {
                throw new IllegalArgumentException("Tài khoản đã bật thông báo trên quá nhiều thiết bị (tối đa "
                        + MAX_DEVICES_PER_USER + "), hãy tắt bớt trên thiết bị cũ");
            }
            subscription = PushSubscription.builder().endpoint(request.endpoint()).build();
        }
        subscription.setUser(user);
        subscription.setChannel(request.channel());
        subscription.setP256dh(request.channel() == PushSubscription.Channel.WEBPUSH ? request.p256dh() : null);
        subscription.setAuth(request.channel() == PushSubscription.Channel.WEBPUSH ? request.auth() : null);
        subscriptionRepository.save(subscription);
    }

    /** Chỉ xoá thiết bị của chính tài khoản đang đăng nhập; không có thì bỏ qua */
    @Transactional
    public void unsubscribe(String username, String endpoint) {
        subscriptionRepository.findByEndpoint(endpoint)
                .filter(s -> s.getUser().getUsername().equals(username))
                .ifPresent(subscriptionRepository::delete);
    }

    /** Gửi thông báo thử tới mọi thiết bị của tài khoản, trả về số thiết bị nhận được */
    public int sendTest(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy người dùng: " + username));
        List<PushSubscription> subscriptions = subscriptionRepository.findByUserId(user.getId());
        if (subscriptions.isEmpty()) {
            throw new IllegalArgumentException("Tài khoản chưa bật thông báo trên thiết bị nào");
        }
        PushMessage message = new PushMessage("AquaMekong", "Thông báo thử: thiết bị này sẽ nhận cảnh báo độ mặn.", "/alerts", "test");
        return (int) deliver(subscriptions, message).stream().filter(r -> r == PushResult.SENT).count();
    }

    /** Chạy sau khi cảnh báo đã lưu (commit), trên luồng riêng để không chặn MeasurementPoller */
    @Async("pushExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAlertCreated(AlertCreatedEvent event) {
        if (!webPushSender.isEnabled() && !fcmSender.isEnabled()) return;
        List<PushSubscription> subscriptions = subscriptionRepository.findAlertRecipients(event.stationId(), STAFF_ROLES);
        if (subscriptions.isEmpty()) return;
        List<PushResult> results = deliver(subscriptions, alertMessage(event));
        log.info("Thông báo cảnh báo #{}: {}/{} thiết bị nhận được", event.alertId(),
                results.stream().filter(r -> r == PushResult.SENT).count(), results.size());
    }

    /** Gửi tới mọi thiết bị của Quản trị và Vận hành, trả về số thiết bị nhận được */
    public int notifyStaff(PushMessage message) {
        if (!webPushSender.isEnabled() && !fcmSender.isEnabled()) return 0;
        List<PushSubscription> subscriptions = subscriptionRepository.findByUserRoleIn(STAFF_ROLES);
        if (subscriptions.isEmpty()) return 0;
        return (int) deliver(subscriptions, message).stream().filter(r -> r == PushResult.SENT).count();
    }

    /** Gửi tới mọi thiết bị của một tài khoản, trả về số thiết bị nhận được */
    public int notifyUser(Long userId, PushMessage message) {
        if (!webPushSender.isEnabled() && !fcmSender.isEnabled()) return 0;
        List<PushSubscription> subscriptions = subscriptionRepository.findByUserId(userId);
        if (subscriptions.isEmpty()) return 0;
        return (int) deliver(subscriptions, message).stream().filter(r -> r == PushResult.SENT).count();
    }

    static PushMessage alertMessage(AlertCreatedEvent event) {
        String[] metric = METRIC_LABELS.getOrDefault(event.metricType(), new String[]{event.metricType(), ""});
        String comparison = switch (event.operator()) {
            case ">", ">=" -> "vượt ngưỡng";
            case "<", "<=" -> "dưới ngưỡng";
            default -> "chạm ngưỡng";
        };
        String body = metric[0] + " " + format(event.value()) + metric[1] + ", " + comparison + " " + format(event.threshold()) + metric[1];
        String title = "Cảnh báo " + severityLabel(event.severity()) + ": " + event.stationName();
        return new PushMessage(title, body, "/alerts", "alert-" + event.alertId());
    }

    private List<PushResult> deliver(List<PushSubscription> subscriptions, PushMessage message) {
        byte[] webPayload = webPayload(message);
        List<PushResult> results = new ArrayList<>();
        List<PushSubscription> gone = new ArrayList<>();
        for (PushSubscription subscription : subscriptions) {
            PushResult result = subscription.getChannel() == PushSubscription.Channel.WEBPUSH
                    ? webPushSender.send(subscription, webPayload)
                    : fcmSender.send(subscription.getEndpoint(), message);
            if (result == PushResult.GONE) gone.add(subscription);
            results.add(result);
        }
        if (!gone.isEmpty()) {
            subscriptionRepository.deleteAll(gone);
            log.info("Đã xoá {} thiết bị không còn nhận thông báo", gone.size());
        }
        return results;
    }

    private byte[] webPayload(PushMessage message) {
        try {
            // Service worker (frontend/public/sw.js) đọc các trường này
            return objectMapper.writeValueAsBytes(message);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private void validate(PushSubscribeRequest request) {
        if (request.channel() == PushSubscription.Channel.FCM) {
            if (!fcmSender.isEnabled()) throw new IllegalArgumentException("Máy chủ chưa bật thông báo cho app (Firebase)");
            if (!FCM_TOKEN.matcher(request.endpoint()).matches()) throw new IllegalArgumentException("Token thiết bị không hợp lệ");
            return;
        }
        if (!webPushSender.isEnabled()) throw new IllegalArgumentException("Máy chủ chưa bật thông báo trình duyệt (VAPID)");
        if (!isAllowedWebPushEndpoint(request.endpoint())) {
            throw new IllegalArgumentException("Địa chỉ nhận thông báo không phải dịch vụ push của trình duyệt");
        }
        try {
            if (WebPushSender.decode(request.p256dh()).length != 65 || WebPushSender.decode(request.auth()).length != 16) {
                throw new IllegalArgumentException("Khoá thông báo không hợp lệ");
            }
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("Khoá thông báo không hợp lệ");
        }
    }

    static boolean isAllowedWebPushEndpoint(String endpoint) {
        try {
            URI uri = new URI(endpoint);
            String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || host == null || uri.getPort() != -1 || uri.getUserInfo() != null) return false;
            String lower = host.toLowerCase(Locale.ROOT);
            return WEB_PUSH_HOSTS.stream().anyMatch(h -> lower.equals(h) || lower.endsWith("." + h));
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static String severityLabel(AlertSeverity severity) {
        return switch (severity) {
            case LOW -> "mức thấp";
            case MEDIUM -> "mức trung bình";
            case HIGH -> "mức cao";
            case CRITICAL -> "khẩn cấp";
        };
    }

    private static String format(double value) {
        return new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN"))).format(value);
    }
}
