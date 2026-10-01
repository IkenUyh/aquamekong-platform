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

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
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
        List<String> roles = request.roles() == null || request.roles().isEmpty() ? List.of(USER_ROLE) : request.roles();
        return toDto(create(request.username(), request.email(), request.fullName(), request.password(), roles));
    }

    /** Tự đăng ký: chỉ ROLE_USER. */
    @Transactional
    public UserDto registerUser(String username, String email, String fullName, String password) {
        return toDto(create(username, email, fullName, password, List.of(USER_ROLE)));
    }

    /**
     * Tạo user từ tài khoản Google/Zalo (chưa có mật khẩu). Username sinh từ phần trước @ của email,
     * hoặc từ tên (bỏ dấu) khi không có email (Zalo); thêm số ngẫu nhiên nếu đã có người dùng.
     */
    @Transactional
    public User createExternalUser(String email, String fullName) {
        String seed = email != null ? emailLocalPart(email) : slugify(fullName);
        return create(uniqueUsernameFrom(seed), email, fullName, null, List.of(USER_ROLE));
    }

    private User create(String username, String email, String fullName, String rawPassword, List<String> roles) {
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username đã tồn tại: " + username);
        }
        if (email != null && userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email đã tồn tại: " + email);
        }

        User user = User.builder()
                .username(username)
                .email(email == null ? null : email.trim())
                .passwordHash(rawPassword == null ? null : passwordEncoder.encode(rawPassword))
                .fullName(fullName == null || fullName.isBlank() ? null : fullName.trim())
                .status(UserStatus.ACTIVE)
                .build();

        User saved = userRepository.save(user);
        for (String roleName : roles) {
            assignRoleToUser(saved.getId(), roleName);
        }
        return saved;
    }

    private static String emailLocalPart(String email) {
        String local = email.substring(0, Math.max(0, email.indexOf('@')));
        return local.contains("+") ? local.substring(0, local.indexOf('+')) : local; // a+tag@gmail.com -> a
    }

    /** "Nguyễn Văn Đức" -> "nguyen.van.duc" */
    static String slugify(String name) {
        if (name == null) return "";
        String ascii = Normalizer.normalize(name.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return ascii.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", ".");
    }

    private String uniqueUsernameFrom(String seed) {
        String base = seed.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "");
        if (base.length() < 3) base = "user" + base;
        base = base.substring(0, Math.min(base.length(), 40));
        String candidate = base;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + (1000 + RANDOM.nextInt(9000));
        }
        return candidate;
    }

    @Transactional
    public void changePassword(String username, String currentPassword, String newPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User không tồn tại: " + username));
        // Tài khoản tạo bằng Google chưa có mật khẩu -> đặt lần đầu không cần mật khẩu cũ
        if (user.getPasswordHash() != null
                && (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash()))) {
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
    private static final String USER_ROLE = "ROLE_USER";
    private static final SecureRandom RANDOM = new SecureRandom();

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
                .hasPassword(user.getPasswordHash() != null)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
