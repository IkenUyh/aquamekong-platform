package com.aquamekong.service.user;

import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.entity.user.Role;
import com.aquamekong.entity.user.User;
import com.aquamekong.entity.user.UserRole;
import com.aquamekong.repository.user.RoleRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.repository.user.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock UserRoleRepository userRoleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks UserService userService;

    private final Role adminRole = Role.builder().id(1L).name("ROLE_ADMIN").build();
    private final User admin = User.builder().id(10L).username("admin").status(UserStatus.ACTIVE).build();
    private final User other = User.builder().id(11L).username("bob").status(UserStatus.ACTIVE).build();

    @Test
    void cannotLockOwnAccount() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> userService.updateUserStatus(10L, UserStatus.SUSPENDED, "admin"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tự khoá");
        verify(userRepository, never()).save(any());
    }

    @Test
    void cannotRemoveOwnAdminRole() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> userService.removeRoleFromUser(10L, "ROLE_ADMIN", "admin"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRoleRepository, never()).deleteByUserIdAndRoleId(anyLong(), anyLong());
    }

    @Test
    void cannotLockLastActiveAdmin() {
        when(userRepository.findById(11L)).thenReturn(Optional.of(other));
        when(userRoleRepository.findByUserId(11L)).thenReturn(List.of(UserRole.builder().user(other).role(adminRole).build()));
        when(roleRepository.findByName("ROLE_ADMIN")).thenReturn(Optional.of(adminRole));
        when(userRoleRepository.findByRoleId(1L)).thenReturn(List.of(UserRole.builder().user(other).role(adminRole).build()));

        assertThatThrownBy(() -> userService.updateUserStatus(11L, UserStatus.INACTIVE, "admin"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cuối cùng");
    }

    @Test
    void roleMustExist() {
        when(userRepository.findById(11L)).thenReturn(Optional.of(other));
        when(roleRepository.findByName(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.assignRoleToUser(11L, "ROLE_HACKER"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
