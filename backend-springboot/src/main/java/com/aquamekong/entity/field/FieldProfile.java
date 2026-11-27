package com.aquamekong.entity.field;

import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.station.Station;
import com.aquamekong.entity.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Hồ sơ một ruộng của người dùng (V15): trạm gần nhất, cây và giống, ngày gieo, diện tích, ao trữ nước ngọt. */
@Entity
@Table(name = "field_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 60)
    private String name;

    /** Trạm gần ruộng nhất, null khi trạm đã bị xoá */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "station_id")
    private Station station;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "crop_id", nullable = false)
    private Crop crop;

    @Column(length = 60)
    private String variety;

    /** Số ngày của giống, từ gieo tới thu hoạch */
    @Column(name = "variety_days")
    private Integer varietyDays;

    /** Ngày gieo sạ hoặc ngày trồng */
    @Column(name = "planted_on")
    private LocalDate plantedOn;

    @Column(name = "area_ha")
    private Double areaHa;

    @Column(name = "has_pond", nullable = false)
    private boolean hasPond;

    @Column(name = "pond_volume_m3")
    private Double pondVolumeM3;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
