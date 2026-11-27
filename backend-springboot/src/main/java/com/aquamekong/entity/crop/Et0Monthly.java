package com.aquamekong.entity.crop;

import jakarta.persistence.*;
import lombok.*;

/** ET₀ (bốc thoát hơi nước tham chiếu FAO, mm/ngày) theo tháng, dùng chung cho cả ĐBSCL (V19), có nguồn. */
@Entity
@Table(name = "et0_monthly")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Et0Monthly {

    /** 1 – 12 */
    @Id
    private Integer month;

    @Column(name = "et0_mm_day", nullable = false)
    private double et0MmDay;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String source;
}
