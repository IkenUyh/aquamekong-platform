package com.aquamekong.dto.user;

import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoleDto {

    private Long id;
    private String name;
    private String description;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
