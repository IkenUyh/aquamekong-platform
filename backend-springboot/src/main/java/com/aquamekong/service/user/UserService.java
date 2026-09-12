package com.aquamekong.service.user;

import com.aquamekong.dto.user.UserDto;
import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.entity.user.Role;
import com.aquamekong.entity.user.User;
import com.aquamekong.entity.user.UserRole;
import com.aquamekong.repository.user.RoleRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.repository.user.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(Long id) {
        return userRepository.findById(id)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public UserDto getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public UserDto createUser(UserDto dto, String rawPassword) {
        if (userRepository.existsByUsername(dto.getUsername())) {
            throw new IllegalArgumentException("Username đã tồn tại: " + dto.getUsername());
        }
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new IllegalArgumentException("Email đã tồn tại: " + dto.getEmail());
        }

        User user = User.builder()
                .username(dto.getUsername())
                .email(dto.getEmail())
                .passwordHash(rawPassword) // Note: In production use BCryptPasswordEncoder
                .fullName(dto.getFullName())
                .status(dto.getStatus() != null ? dto.getStatus() : UserStatus.ACTIVE)
                .build();

        User saved = userRepository.save(user);

        // Assign default role if provided
        if (dto.getRoles() != null && !dto.getRoles().isEmpty()) {
            for (String roleName : dto.getRoles()) {
                assignRoleToUser(saved.getId(), roleName);
            }
        }

        return toDto(saved);
    }

    @Transactional
    public UserDto updateUserStatus(Long userId, UserStatus status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User không tồn tại với ID: " + userId));

        user.setStatus(status);
        User saved = userRepository.save(user);
        return toDto(saved);
    }

    @Transactional
    public void assignRoleToUser(Long userId, String roleName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User không tồn tại với ID: " + userId));

        Role role = roleRepository.findByName(roleName)
                .orElseGet(() -> roleRepository.save(Role.builder().name(roleName).build()));

        if (!userRoleRepository.existsByUserIdAndRoleId(user.getId(), role.getId())) {
            UserRole userRole = UserRole.builder()
                    .user(user)
                    .role(role)
                    .build();
            userRoleRepository.save(userRole);
        }
    }

    @Transactional
    public void removeRoleFromUser(Long userId, String roleName) {
        Role role = roleRepository.findByName(roleName).orElse(null);
        if (role != null) {
            userRoleRepository.deleteByUserIdAndRoleId(userId, role.getId());
        }
    }

    public UserDto toDto(User user) {
        if (user == null) return null;

        List<String> roleNames = userRoleRepository.findByUserId(user.getId()).stream()
                .map(ur -> ur.getRole().getName())
                .collect(Collectors.toList());

        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .status(user.getStatus())
                .roles(roleNames)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
