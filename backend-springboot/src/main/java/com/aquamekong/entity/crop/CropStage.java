package com.aquamekong.entity.crop;

import jakarta.persistence.*;
import lombok.*;

/**
 * Một giai đoạn của cây, theo thứ tự từ lúc gieo/trồng, với ngưỡng cảnh báo theo khuyến cáo Việt Nam.
 * durationDays: số ngày cố định; flexible: giai đoạn nhận phần ngày còn lại của giống. Không cố định cũng không co giãn
 * nghĩa là chưa có nguồn cho mốc ngày (vd. mạ), gộp vào giai đoạn co giãn kế tiếp.
 */
@Entity
@Table(name = "crop_stages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CropStage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "crop_id", nullable = false)
    private Crop crop;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "stage_order", nullable = false)
    private int stageOrder;

    @Column(name = "duration_days")
    private Integer durationDays;

    @Column(nullable = false)
    private boolean flexible;

    @Column(name = "duration_source", columnDefinition = "TEXT")
    private String durationSource;

    /** Báo khi độ mặn vượt mức này (‰), null = chưa có nguồn */
    @Column(name = "max_salinity")
    private Double maxSalinity;

    /** Báo khi độ mặn xuống dưới mức này (‰), chỉ cho mức cần khoảng mặn (nuôi tôm) */
    @Column(name = "min_salinity")
    private Double minSalinity;

    @Column(name = "threshold_source", columnDefinition = "TEXT")
    private String thresholdSource;

    @Column(name = "threshold_note", columnDefinition = "TEXT")
    private String thresholdNote;
}
