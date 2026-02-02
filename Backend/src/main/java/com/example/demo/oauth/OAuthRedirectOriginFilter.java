package com.example.demo.oauth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class OAuthRedirectOriginFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(OAuthRedirectOriginFilter.class);

    public static final String REDIRECT_ORIGIN_COOKIE = "oauth_redirect_origin";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // OAuth2 인증 요청 시작 시 redirect_origin 파라미터를 쿠키에 저장
        if (request.getRequestURI().startsWith("/oauth2/authorization/")) {
            String redirectOrigin = request.getParameter("redirect_origin");
            log.info("[OAuthRedirectOriginFilter] OAuth 요청 감지 - redirect_origin: {}", redirectOrigin);
            log.info("[OAuthRedirectOriginFilter] Request scheme: {}, host: {}, serverName: {}", 
                    request.getScheme(), request.getHeader("Host"), request.getServerName());
            
            if (redirectOrigin != null && !redirectOrigin.isEmpty()) {
                // 쿠키 값 인코딩 (URL에 특수문자가 있을 수 있음)
                String encodedValue = java.net.URLEncoder.encode(redirectOrigin, StandardCharsets.UTF_8);
                
                StringBuilder cookieValue = new StringBuilder();
                cookieValue.append(REDIRECT_ORIGIN_COOKIE).append("=").append(encodedValue);
                cookieValue.append("; Path=/");
                cookieValue.append("; Max-Age=600"); // 10분으로 증가
                cookieValue.append("; HttpOnly");

                // HTTPS에서는 SameSite=None; Secure, HTTP에서는 SameSite=Lax
                // nginx 프록시 뒤에서는 X-Forwarded-Proto 헤더 확인
                if (isSecureRequest(request)) {
                    cookieValue.append("; SameSite=None");
                    cookieValue.append("; Secure");
                } else {
                    cookieValue.append("; SameSite=Lax");
                }

                response.addHeader("Set-Cookie", cookieValue.toString());
                log.info("[OAuthRedirectOriginFilter] 쿠키 설정 완료: {}", cookieValue);
            } else {
                log.warn("[OAuthRedirectOriginFilter] redirect_origin 파라미터가 없습니다!");
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 요청이 HTTPS인지 확인 (nginx 프록시 뒤에서도 동작)
     */
    public static boolean isSecureRequest(HttpServletRequest request) {
        if (request.isSecure()) {
            return true;
        }
        // nginx 프록시에서 전달한 X-Forwarded-Proto 헤더 확인
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        return "https".equalsIgnoreCase(forwardedProto);
    }
}
