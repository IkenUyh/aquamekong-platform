package com.aquamekong.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TopStationDto {
    private Integer rank;
    private String name;
    private String province;
    private Double salinity;
    private String diff; // e.g. "+1.2%"
}
