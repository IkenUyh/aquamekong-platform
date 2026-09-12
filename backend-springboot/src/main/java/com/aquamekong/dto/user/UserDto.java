package com.aquamekong.dto.user;

import com.aquamekong.entity.enums.UserStatus;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {

    private Long id;
    private String username;
    private String email;
    private String fullName;
    private UserStatus status;
    private List<String> roles;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
