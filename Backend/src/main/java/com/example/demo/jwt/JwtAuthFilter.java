package com.example.demo.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;

    public JwtAuthFilter(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();

        // WebSocket 등 JWT 적용 제외 경로
        return path.contains("/api/users/login")
                || path.contains("/api/users/signup")
                || path.contains("/api/users/check-email")
                || path.contains("/api/users/refresh")
                || path.contains("/api/users/logout")
                || path.contains("/api/category")
                || path.contains("/api/meeting-rooms")
                || path.contains("/ws/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // Authorization 헤더 없거나 Bearer 아니면 그냥 통과
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = authHeader.substring(7);

            if (tokenProvider.validateAccessToken(token)) {
                Authentication authentication =
                        tokenProvider.getAuthentication(token);

                SecurityContextHolder.getContext()
                        .setAuthentication(authentication);
            }
        } catch (Exception e) {
            // 토큰 문제 있으면 인증 정보 제거
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}
