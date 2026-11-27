package com.aquamekong.entity.user;

import com.aquamekong.entity.field.FieldProfile;
import com.aquamekong.entity.station.Station;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Một tài khoản theo dõi một trạm, với ngưỡng độ mặn riêng (‰), thường theo loại cây trồng. */
@Entity
@Table(name = "station_watches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationWatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    /** Hồ sơ ruộng đã tạo theo dõi này (ngưỡng theo cây và giai đoạn), null = người dùng đặt tay (V15) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "field_profile_id")
    private FieldProfile fieldProfile;

    @Column(nullable = false)
    private Double threshold;

    /** Cận dưới (‰) cho mức cần khoảng mặn như nuôi tôm: báo cả khi độ mặn xuống dưới mức này, null = không có (V14) */
    @Column(name = "min_threshold")
    private Double minThreshold;

    /** Tên loại cây người dùng chọn (vd. "Lúa"), null = tự đặt ngưỡng */
    @Column(length = 30)
    private String crop;

    /** Lần báo gần nhất là "vượt ngưỡng": chỉ báo lại khi trạng thái đổi */
    @Column(name = "forecast_exceeding", nullable = false)
    @Builder.Default
    private boolean forecastExceeding = false;

    /** Ngày cuối dự báo từng báo có thể vượt ngưỡng: cảnh báo giữ tới hết ngày này (V13) */
    @Column(name = "risk_until")
    private LocalDate riskUntil;

    /** Việc quan trọng của kế hoạch nước lần báo trước (ActionPlan.digest), chỉ với theo dõi của ruộng (V20) */
    @Column(name = "plan_digest", columnDefinition = "TEXT")
    private String planDigest;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
