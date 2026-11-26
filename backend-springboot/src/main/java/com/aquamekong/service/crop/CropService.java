package com.aquamekong.service.crop;

import com.aquamekong.dto.crop.CropDtos.CropDto;
import com.aquamekong.dto.crop.CropDtos.FaoYield;
import com.aquamekong.dto.crop.CropDtos.StageDto;
import com.aquamekong.entity.crop.Crop;
import com.aquamekong.entity.crop.CropStage;
import com.aquamekong.repository.crop.CropRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Bảng cây trồng và ngưỡng mặn (V14), dữ liệu nền cho hồ sơ ruộng và trạm theo dõi. */
@Service
@RequiredArgsConstructor
public class CropService {

    /** Xấp xỉ đổi độ dẫn điện nước tưới (dS/m) sang độ mặn (‰) */
    static final double PPT_PER_DS_M = 0.64;

    private final CropRepository cropRepository;

    @Transactional(readOnly = true)
    public List<CropDto> list() {
        return cropRepository.findAllByOrderBySortOrderAsc().stream().map(CropService::toDto).toList();
    }

    static CropDto toDto(Crop crop) {
        FaoYield fao = crop.getFaoEcw100() == null ? null : new FaoYield(
                crop.getFaoEcw100(), crop.getFaoEcw90(), crop.getFaoEcw75(), crop.getFaoEcw50(),
                toPpt(crop.getFaoEcw100()), toPpt(crop.getFaoEcw90()), toPpt(crop.getFaoEcw75()), toPpt(crop.getFaoEcw50()),
                crop.getFaoSource());
        List<StageDto> stages = crop.getStages().stream().map(CropService::toDto).toList();
        return new CropDto(crop.getCode(), crop.getName(), crop.getCategory().name(), fao, crop.getFaoNote(), stages);
    }

    private static StageDto toDto(CropStage s) {
        return new StageDto(s.getCode(), s.getName(), s.getStageOrder(), s.getDurationDays(), s.isFlexible(),
                s.getDurationSource(), s.getMaxSalinity(), s.getMinSalinity(), s.getThresholdSource(), s.getThresholdNote(),
                s.getSaltSensitivity(), s.getSensitivitySource());
    }

    /** dS/m → ‰, làm tròn 2 chữ số */
    public static double toPpt(double dsPerM) {
        return Math.round(dsPerM * PPT_PER_DS_M * 100) / 100.0;
    }
}
