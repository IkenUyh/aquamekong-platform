package com.aquamekong.security;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Phân quyền theo role có sẵn trong DB (ROLE_ADMIN, ROLE_OPERATOR, ROLE_USER):
 * - USER: xem dữ liệu, chạy dự báo
 * - OPERATOR: + thêm/sửa/xoá trạm, thiết bị, rule cảnh báo, xử lý cảnh báo
 * - ADMIN: + quản lý người dùng
 * - DEVICE (X-API-Key): chỉ /measurements/ingest
 */
@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ApiKeyAuthenticationFilter apiKeyAuthenticationFilter;
    private final JsonAuthErrorHandler authErrorHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Token nằm ở header Authorization (không dùng cookie) nên không cần CSRF
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .exceptionHandling(e -> e.authenticationEntryPoint(authErrorHandler).accessDeniedHandler(authErrorHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/", "/error", "/actuator/health", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/measurements/ingest").hasAnyRole("DEVICE", "OPERATOR", "ADMIN")
                        .requestMatchers("/api/v1/users/**").hasRole("ADMIN")
                        // Xoá trạm xoá dây chuyền toàn bộ số đo & cảnh báo của trạm -> chỉ ADMIN
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/stations/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/auth/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/forecasts/predict").hasAnyRole("USER", "OPERATOR", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/**").hasAnyRole("USER", "OPERATOR", "ADMIN")
                        .requestMatchers("/api/**").hasAnyRole("OPERATOR", "ADMIN")
                        .anyRequest().denyAll())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(apiKeyAuthenticationFilter, JwtAuthenticationFilter.class);
        return http.build();
    }

    // Hai filter là @Component -> Spring Boot sẽ tự đăng ký thêm vào servlet chain; chỉ chạy trong security chain
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<ApiKeyAuthenticationFilter> apiKeyFilterRegistration(ApiKeyAuthenticationFilter filter) {
        FilterRegistrationBean<ApiKeyAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }
}
