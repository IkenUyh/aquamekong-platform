package com.aquamekong.security;

import com.aquamekong.dto.user.CreateUserRequest;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.service.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

/**
 * DB chưa có user nào -> tạo tài khoản admin đầu tiên từ ADMIN_USERNAME / ADMIN_PASSWORD.
 * Không cấu hình mật khẩu thì sinh ngẫu nhiên và in ra log đúng một lần.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {

    private final UserRepository userRepository;
    private final UserService userService;

    @Value("${app.security.bootstrap-admin.username:admin}")
    private String username;
    @Value("${app.security.bootstrap-admin.email:admin@aquamekong.local}")
    private String email;
    @Value("${app.security.bootstrap-admin.password:}")
    private String password;

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }
        boolean generated = password == null || password.isBlank();
        String pwd = generated ? randomPassword() : password;
        userService.createUser(new CreateUserRequest(username, email, "Quản trị viên", pwd, List.of("ROLE_ADMIN")));
        if (generated) {
            log.warn("Đã tạo tài khoản admin '{}' với mật khẩu ngẫu nhiên: {} — hãy đăng nhập và đổi mật khẩu ngay.", username, pwd);
        } else {
            log.info("Đã tạo tài khoản admin '{}' từ ADMIN_PASSWORD.", username);
        }
    }

    private static String randomPassword() {
        byte[] bytes = new byte[12];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
