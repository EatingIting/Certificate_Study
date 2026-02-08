package com.example.demo.jwt;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RefreshTokenCookieService {

    public static final String REFRESH_TOKEN_COOKIE = "refreshToken";

    private final int rememberMeMaxAgeSeconds;

    public RefreshTokenCookieService(
            @Value("${jwt.refresh-cookie-max-age-seconds:2592000}") int rememberMeMaxAgeSeconds
    ) {
        this.rememberMeMaxAgeSeconds = rememberMeMaxAgeSeconds;
    }

    public void addRefreshTokenCookie(
            HttpServletRequest request,
            HttpServletResponse response,
            String refreshToken,
            boolean rememberMe
    ) {
        StringBuilder cookie = new StringBuilder();
        cookie.append(REFRESH_TOKEN_COOKIE).append("=").append(refreshToken);
        cookie.append("; Path=/");
        cookie.append("; HttpOnly");
        if (rememberMe) {
            cookie.append("; Max-Age=").append(rememberMeMaxAgeSeconds);
        }

        if (isSecureRequest(request)) {
            cookie.append("; SameSite=None");
            cookie.append("; Secure");
        } else {
            cookie.append("; SameSite=Lax");
        }

        response.addHeader("Set-Cookie", cookie.toString());
    }

    public void clearRefreshTokenCookie(HttpServletRequest request, HttpServletResponse response) {
        StringBuilder cookie = new StringBuilder();
        cookie.append(REFRESH_TOKEN_COOKIE).append("=;");
        cookie.append(" Path=/;");
        cookie.append(" Max-Age=0;");
        cookie.append(" HttpOnly;");

        if (isSecureRequest(request)) {
            cookie.append(" SameSite=None;");
            cookie.append(" Secure;");
        } else {
            cookie.append(" SameSite=Lax;");
        }

        response.addHeader("Set-Cookie", cookie.toString());
    }

    public String resolveRefreshToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (REFRESH_TOKEN_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private boolean isSecureRequest(HttpServletRequest request) {
        if (request.isSecure()) {
            return true;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        return "https".equalsIgnoreCase(forwardedProto);
    }
}
