package com.aquamekong.entity.user;

import com.aquamekong.entity.station.Station;
import jakarta.persistence.*;
import lombok.*;

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

    @Column(nullable = false)
    private Double threshold;

    /** Tên loại cây người dùng chọn (vd. "Lúa"), null = tự đặt ngưỡng */
    @Column(length = 30)
    private String crop;

    /** Lần báo gần nhất là "vượt ngưỡng": chỉ báo lại khi trạng thái đổi */
    @Column(name = "forecast_exceeding", nullable = false)
    @Builder.Default
    private boolean forecastExceeding = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
