package com.aquamekong.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

/**
 * GeoJSON FeatureCollection response wrapper.
 * Chuẩn GeoJSON RFC 7946.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeoJsonResponse {

    @Builder.Default
    private String type = "FeatureCollection";

    private List<Feature> features;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Feature {
        @Builder.Default
        private String type = "Feature";
        private Geometry geometry;
        private Map<String, Object> properties;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Geometry {
        @Builder.Default
        private String type = "Point";
        private double[] coordinates; // [lng, lat]
    }
}
