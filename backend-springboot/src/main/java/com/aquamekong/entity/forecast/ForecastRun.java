package com.aquamekong.entity.forecast;

import com.aquamekong.entity.enums.ForecastRunStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "forecast_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForecastRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_version", nullable = false, length = 50)
    private String modelVersion;

    @Column(name = "run_at", nullable = false)
    private OffsetDateTime runAt;

    @Column(name = "input_from")
    private OffsetDateTime inputFrom;

    @Column(name = "input_to")
    private OffsetDateTime inputTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ForecastRunStatus status = ForecastRunStatus.RUNNING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
