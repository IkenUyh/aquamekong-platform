package com.aquamekong.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "salinity_forecasts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalinityForecast {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "station_id", nullable = false)
    @JsonIgnore
    private Station station;

    /** Ngày dự báo */
    @Column(name = "forecast_date", nullable = false)
    private LocalDate forecastDate;

    /** Độ mặn dự báo (‰) */
    @Column(name = "predicted_salinity", nullable = false)
    private Double predictedSalinity;

    /** Mức tin cậy (0-1) */
    @Column(name = "confidence_level")
    private Double confidenceLevel;

    /** Cận dưới khoảng tin cậy */
    @Column(name = "lower_bound")
    private Double lowerBound;

    /** Cận trên khoảng tin cậy */
    @Column(name = "upper_bound")
    private Double upperBound;

    /** Phiên bản model ML */
    @Column(name = "model_version", length = 50)
    private String modelVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
