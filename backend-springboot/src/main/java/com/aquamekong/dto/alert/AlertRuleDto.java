package com.aquamekong.dto.alert;

import com.aquamekong.entity.enums.AlertSeverity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertRuleDto {

    private Long id;
    @NotNull(message = "Chưa chọn trạm")
    private Long stationId;
    private String stationCode;
    private String stationName;

    @NotBlank(message = "Chưa chọn chỉ số")
    private String metricType;
    /** Mặc định ">" */
    @Pattern(regexp = ">|>=|<|<=|==", message = "Toán tử phải là >, >=, <, <= hoặc ==")
    private String operator;
    @NotNull(message = "Chưa nhập ngưỡng")
    private Double threshold;
    private AlertSeverity severity;
    private Boolean isActive;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
