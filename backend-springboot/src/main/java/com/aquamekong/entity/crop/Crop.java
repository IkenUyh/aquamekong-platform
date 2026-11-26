package com.aquamekong.entity.crop;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/** Cây trồng hoặc mục đích dùng nước (nước sinh hoạt, nuôi tôm), với giai đoạn và ngưỡng mặn có ghi nguồn (V14). */
@Entity
@Table(name = "crops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Crop {

    public enum Category { CROP, DOMESTIC_WATER, AQUACULTURE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Category category;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** FAO 29 Table 4: ECw (dS/m) ứng với năng suất 100/90/75/50%, null = FAO không có cây này */
    @Column(name = "fao_ecw_100")
    private Double faoEcw100;

    @Column(name = "fao_ecw_90")
    private Double faoEcw90;

    @Column(name = "fao_ecw_75")
    private Double faoEcw75;

    @Column(name = "fao_ecw_50")
    private Double faoEcw50;

    @Column(name = "fao_source", columnDefinition = "TEXT")
    private String faoSource;

    @Column(name = "fao_note", columnDefinition = "TEXT")
    private String faoNote;

    /** Năng suất bình thường mặc định (tấn/ha), null = chưa có nguồn (V18) */
    @Column(name = "default_yield_t_ha")
    private Double defaultYieldTHa;

    /** Giá bán mặc định (đồng/kg), null = chưa có nguồn (V18) */
    @Column(name = "default_price_vnd_kg")
    private Double defaultPriceVndKg;

    @Column(name = "yield_source", columnDefinition = "TEXT")
    private String yieldSource;

    @Column(name = "price_source", columnDefinition = "TEXT")
    private String priceSource;

    @Column(name = "price_as_of")
    private java.time.LocalDate priceAsOf;

    @OneToMany(mappedBy = "crop", fetch = FetchType.LAZY)
    @OrderBy("stageOrder ASC")
    @Builder.Default
    private List<CropStage> stages = new ArrayList<>();
}
