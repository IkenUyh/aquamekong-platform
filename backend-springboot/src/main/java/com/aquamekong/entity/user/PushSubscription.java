package com.aquamekong.entity.user;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/** Một thiết bị/trình duyệt nhận thông báo đẩy khi có cảnh báo mới. */
@Entity
@Table(name = "push_subscriptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscription {

    public enum Channel { WEBPUSH, FCM }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Channel channel;

    /** WEBPUSH: URL dịch vụ push của trình duyệt. FCM: registration token. */
    @Column(nullable = false, unique = true, length = 1000)
    private String endpoint;

    /** Khoá công khai P-256 của trình duyệt (base64url), chỉ WEBPUSH */
    @Column(length = 200)
    private String p256dh;

    /** Auth secret 16 byte (base64url), chỉ WEBPUSH */
    @Column(length = 100)
    private String auth;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
