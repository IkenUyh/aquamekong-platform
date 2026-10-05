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

    @Test
    void accountWithoutPasswordCanSetOneWithoutCurrentPassword() {
        User googleUser = User.builder().id(12L).username("an").status(UserStatus.ACTIVE).build();
        when(userRepository.findByUsername("an")).thenReturn(Optional.of(googleUser));
        when(passwordEncoder.encode("new-password")).thenReturn("hashed");

        userService.changePassword("an", null, "new-password");

        verify(userRepository).save(googleUser);
        org.assertj.core.api.Assertions.assertThat(googleUser.getPasswordHash()).isEqualTo("hashed");
    }

    @Test
    void existingPasswordIsRequiredToChangeIt() {
        User user = User.builder().id(12L).username("an").passwordHash("old-hash").status(UserStatus.ACTIVE).build();
        when(userRepository.findByUsername("an")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.changePassword("an", null, "new-password"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void externalUserGetsUniqueUsernameAndOnlyUserRole() {
        Role userRole = Role.builder().id(3L).name("ROLE_USER").build();
        // "nguyen.van-a" đã có người dùng -> phải thêm số
        when(userRepository.existsByUsername(anyString())).thenAnswer(inv -> "nguyen.van-a".equals(inv.getArgument(0)));
        when(userRepository.existsByEmailIgnoreCase("Nguyen.Van-A+tag@gmail.com")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(20L);
            return u;
        });
        when(userRepository.findById(20L)).thenAnswer(inv -> Optional.of(User.builder().id(20L).build()));
        when(roleRepository.findByName("ROLE_USER")).thenReturn(Optional.of(userRole));

        User created = userService.createExternalUser("Nguyen.Van-A+tag@gmail.com", "Nguyễn Văn A");

        org.assertj.core.api.Assertions.assertThat(created.getUsername()).matches("nguyen\\.van-a\\d{4}");
        org.assertj.core.api.Assertions.assertThat(created.getPasswordHash()).isNull();
        verify(roleRepository).findByName("ROLE_USER");
        verify(roleRepository, never()).findByName("ROLE_ADMIN");
    }

    @Test
    void slugifyStripsVietnameseDiacritics() {
        org.assertj.core.api.Assertions.assertThat(UserService.slugify("  Nguyễn Văn Đức ")).isEqualTo("nguyen.van.duc");
        org.assertj.core.api.Assertions.assertThat(UserService.slugify(null)).isEmpty();
    }

    @Test
    void externalUserWithoutEmailGetsUsernameFromName() {
        Role userRole = Role.builder().id(3L).name("ROLE_USER").build();
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(21L);
            return u;
        });
        when(userRepository.findById(21L)).thenAnswer(inv -> Optional.of(User.builder().id(21L).build()));
        when(roleRepository.findByName("ROLE_USER")).thenReturn(Optional.of(userRole));

        User created = userService.createExternalUser(null, "Trần Thị Bé");

        org.assertj.core.api.Assertions.assertThat(created.getUsername()).isEqualTo("tran.thi.be");
        org.assertj.core.api.Assertions.assertThat(created.getEmail()).isNull();
        verify(userRepository, never()).existsByEmailIgnoreCase(any());
    }
}
