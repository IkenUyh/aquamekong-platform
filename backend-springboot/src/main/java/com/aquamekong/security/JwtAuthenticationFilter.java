package com.aquamekong.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** EventSource của trình duyệt không gửi được header, nên SSE nhận token qua query param. */
    static final String SSE_PATH = "/api/v1/telemetry/stream";

    private final JwtService jwtService;
    private final JsonAuthErrorHandler authErrorHandler;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = resolveToken(request);
        var current = SecurityContextHolder.getContext().getAuthentication();
        if (token != null && (current == null || current instanceof AnonymousAuthenticationToken)) {
            var claims = jwtService.parse(token);
            if (claims.isEmpty()) {
                // Token hết hạn / sai: trả 401 ngay cả ở API công khai, để frontend biết phiên đã hết
                // thay vì lặng lẽ coi như người chưa đăng nhập
                authErrorHandler.commence(request, response, new BadCredentialsException("Token không hợp lệ"));
                return;
            }
            var authorities = JwtService.roles(claims.get()).stream().map(SimpleGrantedAuthority::new).toList();
            var auth = new UsernamePasswordAuthenticationToken(claims.get().getSubject(), null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        if (SSE_PATH.equals(request.getRequestURI())) {
            return request.getParameter("access_token");
        }
        return null;
    }
}
