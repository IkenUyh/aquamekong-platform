package com.aquamekong.service.push;

import com.aquamekong.dto.push.PushSubscribeRequest;
import com.aquamekong.entity.enums.AlertSeverity;
import com.aquamekong.entity.user.PushSubscription;
import com.aquamekong.entity.user.User;
import com.aquamekong.repository.user.PushSubscriptionRepository;
import com.aquamekong.repository.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PushServiceTest {

    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";
    private static final String P256DH = Base64.getUrlEncoder().withoutPadding().encodeToString(p256Point());
    private static final String AUTH = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);

    @Mock PushSubscriptionRepository subscriptionRepository;
    @Mock UserRepository userRepository;
    @Mock WebPushSender webPushSender;
    @Mock FcmSender fcmSender;
    PushService pushService;

    private final User alice = User.builder().id(1L).username("alice").build();

    @BeforeEach
    void setUp() {
        pushService = new PushService(subscriptionRepository, userRepository, webPushSender, fcmSender, new ObjectMapper());
        when(webPushSender.isEnabled()).thenReturn(true);
        when(fcmSender.isEnabled()).thenReturn(true);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://fcm.googleapis.com/fcm/send/abc",
            "https://updates.push.services.mozilla.com/wpush/v2/abc",
            "https://web.push.apple.com/abc",
            "https://wns2-par02p.notify.windows.com/w/?token=abc"})
    void acceptsBrowserPushServices(String endpoint) {
        assertThat(PushService.isAllowedWebPushEndpoint(endpoint)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://fcm.googleapis.com/fcm/send/abc",
            "https://backend:8080/api/v1/users",
            "https://169.254.169.254/latest/meta-data",
            "https://fcm.googleapis.com.evil.example/x",
            "https://evilfcm.googleapis.com.example/x",
            "https://fcm.googleapis.com:8443/x",
            "https://user@fcm.googleapis.com/x",
            "không phải url"})
    void rejectsEndpointsOutsidePushServices(String endpoint) {
        assertThat(PushService.isAllowedWebPushEndpoint(endpoint)).isFalse();
    }

    @Test
    void subscribeStoresBrowserKeysForCurrentUser() {
        when(subscriptionRepository.findByEndpoint(ENDPOINT)).thenReturn(Optional.empty());

        pushService.subscribe("alice", new PushSubscribeRequest(PushSubscription.Channel.WEBPUSH, ENDPOINT, P256DH, AUTH));

        ArgumentCaptor<PushSubscription> saved = ArgumentCaptor.forClass(PushSubscription.class);
        verify(subscriptionRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(alice);
        assertThat(saved.getValue().getP256dh()).isEqualTo(P256DH);
    }

    @Test
    void subscribeRejectsInternalEndpoint() {
        assertThatThrownBy(() -> pushService.subscribe("alice",
                new PushSubscribeRequest(PushSubscription.Channel.WEBPUSH, "https://backend:8080/x", P256DH, AUTH)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void subscribeRejectsBadKeys() {
        assertThatThrownBy(() -> pushService.subscribe("alice",
                new PushSubscribeRequest(PushSubscription.Channel.WEBPUSH, ENDPOINT, "abc", AUTH)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Khoá thông báo");
    }

    @Test
    void subscribeLimitsDevicesPerUser() {
        when(subscriptionRepository.findByEndpoint(any())).thenReturn(Optional.empty());
        when(subscriptionRepository.countByUserId(1L)).thenReturn((long) PushService.MAX_DEVICES_PER_USER);

        assertThatThrownBy(() -> pushService.subscribe("alice",
                new PushSubscribeRequest(PushSubscription.Channel.FCM, "fcm-token-abcdefghijklmnop", null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unsubscribeIgnoresOtherUsersDevices() {
        User bob = User.builder().id(2L).username("bob").build();
        when(subscriptionRepository.findByEndpoint(ENDPOINT))
                .thenReturn(Optional.of(PushSubscription.builder().user(bob).endpoint(ENDPOINT).build()));

        pushService.unsubscribe("alice", ENDPOINT);

        verify(subscriptionRepository, never()).delete(any());
    }

    @Test
    void alertGoesToEveryDeviceAndDropsUnsubscribedOnes() {
        PushSubscription browser = PushSubscription.builder().id(1L).channel(PushSubscription.Channel.WEBPUSH).endpoint(ENDPOINT).build();
        PushSubscription phone = PushSubscription.builder().id(2L).channel(PushSubscription.Channel.FCM).endpoint("fcm-token").build();
        when(subscriptionRepository.findAll()).thenReturn(List.of(browser, phone));
        when(webPushSender.send(eq(browser), any())).thenReturn(PushResult.SENT);
        when(fcmSender.send(eq("fcm-token"), any())).thenReturn(PushResult.GONE);

        pushService.onAlertCreated(new AlertCreatedEvent(9L, "Mỹ Tho", "salinity", ">", 5.2, 4.0, AlertSeverity.HIGH));

        verify(subscriptionRepository).deleteAll(List.of(phone));
    }

    @Test
    void alertMessageIsVietnamese() {
        PushMessage message = PushService.alertMessage(new AlertCreatedEvent(9L, "Mỹ Tho", "salinity", ">", 5.25, 4.0, AlertSeverity.HIGH));

        assertThat(message.title()).isEqualTo("Cảnh báo mức cao: Mỹ Tho");
        assertThat(message.body()).isEqualTo("Độ mặn 5,25‰, vượt ngưỡng 4‰");
        assertThat(message.url()).isEqualTo("/alerts");
    }

    @Test
    void testNotificationRequiresADevice() {
        when(subscriptionRepository.findByUserId(1L)).thenReturn(List.of());

        assertThatThrownBy(() -> pushService.sendTest("alice")).isInstanceOf(IllegalArgumentException.class);
    }

    private static byte[] p256Point() {
        byte[] point = new byte[65];
        point[0] = 4;
        return point;
    }
}
