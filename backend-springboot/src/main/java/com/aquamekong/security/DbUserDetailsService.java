package com.aquamekong.security;

import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.repository.user.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DbUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) {
        var user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));
        var authorities = userRoleRepository.findByUserId(user.getId()).stream()
                .map(ur -> new SimpleGrantedAuthority(ur.getRole().getName()))
                .toList();
        return User.withUsername(user.getUsername())
                // Chưa đặt mật khẩu (tạo bằng Google) -> chuỗi rỗng, BCrypt không bao giờ khớp
                .password(user.getPasswordHash() == null ? "" : user.getPasswordHash())
                .authorities(authorities)
                .disabled(user.getStatus() != UserStatus.ACTIVE)
                .build();
    }
}
