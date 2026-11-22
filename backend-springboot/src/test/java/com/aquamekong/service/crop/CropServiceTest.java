package com.aquamekong.service.crop;

import com.aquamekong.dto.crop.CropDtos.CropDto;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.repository.crop.CropRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CropServiceTest {

    @Test
    void faoValuesAreKeptAsPrintedAndConvertedToPpt() {
        Crop rice = Crop.builder().code("lua").name("Lúa").category(Crop.Category.CROP).sortOrder(10)
                .faoEcw100(2.0).faoEcw90(2.6).faoEcw75(3.4).faoEcw50(4.8).faoSource("FAO 29").build();
        rice.setStages(List.of(
                CropStage.builder().code("ma").name("Mạ").stageOrder(1).maxSalinity(1.0).thresholdSource("A").build(),
                CropStage.builder().code("chin").name("Chín").stageOrder(4).durationDays(30).durationSource("IRRI")
                        .maxSalinity(4.0).thresholdSource("A").build()));

        CropDto dto = CropService.toDto(rice);

        assertThat(dto.faoYield().ecw100()).isEqualTo(2.0);
        // 2,0 / 2,6 / 3,4 / 4,8 dS/m × 0,64
        assertThat(List.of(dto.faoYield().ppt100(), dto.faoYield().ppt90(), dto.faoYield().ppt75(), dto.faoYield().ppt50()))
                .containsExactly(1.28, 1.66, 2.18, 3.07);
        assertThat(dto.stages()).extracting(s -> s.code()).containsExactly("ma", "chin");
        assertThat(dto.stages().get(1).durationDays()).isEqualTo(30);
    }

    @Test
    void cropWithoutFaoDataHasNoYieldCurve() {
        Crop durian = Crop.builder().code("sau_rieng").name("Sầu riêng").category(Crop.Category.CROP).sortOrder(20)
                .faoNote("FAO 29 không có sầu riêng.").build();
        CropRepository repository = mock(CropRepository.class);
        when(repository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(durian));

        CropDto dto = new CropService(repository).list().get(0);

        assertThat(dto.faoYield()).isNull();
        assertThat(dto.faoNote()).isEqualTo("FAO 29 không có sầu riêng.");
        assertThat(dto.category()).isEqualTo("CROP");
    }
}
