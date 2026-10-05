package com.aquamekong.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MetricTypesTest {

    @Test
    void normalizesToTrimmedLowerCase() {
        assertThat(MetricTypes.normalize(" SALINITY ")).isEqualTo("salinity");
        assertThat(MetricTypes.normalize("Water_Level")).isEqualTo("water_level");
    }

    @Test
    void keepsNull() {
        assertThat(MetricTypes.normalize(null)).isNull();
    }
}
