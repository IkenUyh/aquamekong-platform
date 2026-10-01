package com.aquamekong.service.auth;

import com.aquamekong.client.ZaloOAuthClient;
import com.aquamekong.dto.auth.AuthConfigDto;
import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.dto.auth.RegisterRequest;
import com.aquamekong.dto.user.UserDto;
import com.aquamekong.security.GoogleIdTokenVerifier;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.LoginAttemptService;
import com.aquamekong.service.user.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;
    private final LoginAttemptService loginAttemptService;
    private final GoogleIdTokenVerifier googleVerifier;
    private final ZaloOAuthClient zaloClient;
    private final boolean publicRead;
    private final boolean registrationEnabled;

    public AuthService(AuthenticationManager authenticationManager,
                       JwtService jwtService,
                       UserService userService,
                       LoginAttemptService loginAttemptService,
                       GoogleIdTokenVerifier googleVerifier,
                       ZaloOAuthClient zaloClient,
                       @Value("${app.security.public-read:true}") boolean publicRead,
                       @Value("${app.security.registration-enabled:true}") boolean registrationEnabled) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userService = userService;
        this.loginAttemptService = loginAttemptService;
        this.googleVerifier = googleVerifier;
        this.zaloClient = zaloClient;
        this.publicRead = publicRead;
        this.registrationEnabled = registrationEnabled;
    }

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

        return issueToken(userService.getUserByUsername(username));
    }

    public LoginResponse register(RegisterRequest request) {
        requireRegistrationEnabled();
        return issueToken(userService.registerUser(request.username(), request.email(), request.fullName(), request.password()));
    }

    public AuthConfigDto config() {
        return new AuthConfigDto(publicRead, registrationEnabled, googleVerifier.getClientId(), zaloClient.getAppId());
    }

    void requireRegistrationEnabled() {
        if (!registrationEnabled) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hệ thống chưa mở đăng ký, vui lòng liên hệ quản trị viên để được cấp tài khoản");
        }
    }

    LoginResponse issueToken(UserDto user) {
        String token = jwtService.issue(user.getUsername(), user.getRoles());
        return new LoginResponse(token, "Bearer", jwtService.getExpirationSeconds(), user);
    }
}
