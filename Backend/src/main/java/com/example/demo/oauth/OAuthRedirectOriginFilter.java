package com.example.demo.oauth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class OAuthRedirectOriginFilter extends OncePerRequestFilter {

    public static final String REDIRECT_ORIGIN_COOKIE = "oauth_redirect_origin";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // OAuth2 인증 요청 시작 시 redirect_origin 파라미터를 쿠키에 저장
        if (request.getRequestURI().startsWith("/oauth2/authorization/")) {
            String redirectOrigin = request.getParameter("redirect_origin");
            if (redirectOrigin != null && !redirectOrigin.isEmpty()) {
                // SameSite=None; Secure 설정을 위해 Set-Cookie 헤더 직접 설정
                StringBuilder cookieValue = new StringBuilder();
                cookieValue.append(REDIRECT_ORIGIN_COOKIE).append("=").append(redirectOrigin);
                cookieValue.append("; Path=/");
                cookieValue.append("; Max-Age=300");
                cookieValue.append("; HttpOnly");
                // Cross-site 요청에서도 쿠키가 전송되도록 SameSite=None; Secure 설정
                cookieValue.append("; SameSite=None");
                cookieValue.append("; Secure");
                response.addHeader("Set-Cookie", cookieValue.toString());
            }
        }

        filterChain.doFilter(request, response);
    }
}
