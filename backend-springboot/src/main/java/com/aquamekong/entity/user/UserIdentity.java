package com.aquamekong.entity.user;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/** Tài khoản ngoài (Google, Zalo...) đã liên kết với một user. */
@Entity
@Table(name = "user_identities", uniqueConstraints = {
    @UniqueConstraint(name = "uq_identity_provider_user", columnNames = {"provider", "provider_user_id"}),
    @UniqueConstraint(name = "uq_identity_user_provider", columnNames = {"user_id", "provider"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserIdentity {

    public static final String GOOGLE = "google";
    public static final String ZALO = "zalo";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String provider;

    @Column(name = "provider_user_id", nullable = false, length = 255)
    private String providerUserId;

    @Column(length = 100)
    private String email;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
