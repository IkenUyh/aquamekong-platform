package com.aquamekong.service.auth;

import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.dto.user.UserDto;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.LoginAttemptService;
import com.aquamekong.service.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;
    private final LoginAttemptService loginAttemptService;

    public LoginResponse login(String username, String password, String clientIp) {
        String attemptKey = username.toLowerCase() + "|" + clientIp;
        if (loginAttemptService.isLocked(attemptKey)) {
            throw new LockedException("Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 5 phút");
        }
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
        } catch (AuthenticationException e) {
            loginAttemptService.onFailure(attemptKey);
            // Không phân biệt "sai username" và "sai mật khẩu" để tránh dò tài khoản
            throw new BadCredentialsException("Tên đăng nhập hoặc mật khẩu không đúng");
        }
        loginAttemptService.onSuccess(attemptKey);

        UserDto user = userService.getUserByUsername(username);
        String token = jwtService.issue(user.getUsername(), user.getRoles());
        return new LoginResponse(token, "Bearer", jwtService.getExpirationSeconds(), user);
    }
}
