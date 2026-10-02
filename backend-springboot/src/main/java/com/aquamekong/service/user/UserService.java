package com.aquamekong.service.user;

import com.aquamekong.dto.user.CreateUserRequest;
import com.aquamekong.dto.user.UserDto;
import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.entity.user.Role;
import com.aquamekong.entity.user.User;
import com.aquamekong.entity.user.UserRole;
import com.aquamekong.repository.user.RoleRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.repository.user.UserRoleRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final PasswordEncoder passwordEncoder;

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
                .orElseThrow(() -> new EntityNotFoundException("User không tồn tại với ID: " + id));
    }

    @Transactional(readOnly = true)
    public UserDto getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(this::toDto)
                .orElseThrow(() -> new EntityNotFoundException("User không tồn tại: " + username));
    }

    @Transactional
    public UserDto createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username đã tồn tại: " + request.username());
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email đã tồn tại: " + request.email());
        }

        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .fullName(request.fullName())
                .status(UserStatus.ACTIVE)
                .build();

        User saved = userRepository.save(user);

        List<String> roles = request.roles() == null || request.roles().isEmpty() ? List.of("ROLE_USER") : request.roles();
        for (String roleName : roles) {
            assignRoleToUser(saved.getId(), roleName);
        }

        return toDto(saved);
    }

    @Transactional
    public void changePassword(String username, String currentPassword, String newPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User không tồn tại: " + username));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Mật khẩu hiện tại không đúng");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    @Transactional
    public UserDto updateUserStatus(Long userId, UserStatus status, String actingUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User không tồn tại với ID: " + userId));
        if (status != UserStatus.ACTIVE && user.getUsername().equals(actingUsername)) {
            throw new IllegalArgumentException("Không thể tự khoá tài khoản đang đăng nhập");
        }
        if (status != UserStatus.ACTIVE && isAdmin(user.getId()) && countActiveAdmins() <= 1) {
            throw new IllegalArgumentException("Không thể khoá quản trị viên cuối cùng");
        }

        user.setStatus(status);
        User saved = userRepository.save(user);
        return toDto(saved);
    }

    @Transactional
    public void assignRoleToUser(Long userId, String roleName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User không tồn tại với ID: " + userId));

        // Chỉ gán role có sẵn (V2 seed) — không cho tạo role tuỳ ý qua API
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalArgumentException("Role không tồn tại: " + roleName));

        if (!userRoleRepository.existsByUserIdAndRoleId(user.getId(), role.getId())) {
            UserRole userRole = UserRole.builder()
                    .user(user)
                    .role(role)
                    .build();
            userRoleRepository.save(userRole);
        }
    }

    @Transactional
    public void removeRoleFromUser(Long userId, String roleName, String actingUsername) {
        if (ADMIN_ROLE.equals(roleName)) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new EntityNotFoundException("User không tồn tại với ID: " + userId));
            if (user.getUsername().equals(actingUsername)) {
                throw new IllegalArgumentException("Không thể tự gỡ quyền quản trị của chính mình");
            }
            if (isAdmin(userId) && countActiveAdmins() <= 1) {
                throw new IllegalArgumentException("Không thể gỡ quyền của quản trị viên cuối cùng");
            }
        }
        Role role = roleRepository.findByName(roleName).orElse(null);
        if (role != null) {
            userRoleRepository.deleteByUserIdAndRoleId(userId, role.getId());
        }
    }

    private static final String ADMIN_ROLE = "ROLE_ADMIN";

    private boolean isAdmin(Long userId) {
        return userRoleRepository.findByUserId(userId).stream().anyMatch(ur -> ADMIN_ROLE.equals(ur.getRole().getName()));
    }

    private long countActiveAdmins() {
        return roleRepository.findByName(ADMIN_ROLE)
                .map(role -> userRoleRepository.findByRoleId(role.getId()).stream()
                        .filter(ur -> ur.getUser().getStatus() == UserStatus.ACTIVE)
                        .count())
                .orElse(0L);
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
