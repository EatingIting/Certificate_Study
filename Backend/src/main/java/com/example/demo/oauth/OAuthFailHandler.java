package com.example.demo.oauth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuthFailHandler extends SimpleUrlAuthenticationFailureHandler {

    @Value("${app.frontend-url:}")
    private String configuredFrontendUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception)
            throws IOException {

        String msg = URLEncoder.encode(
                exception.getMessage(),
                StandardCharsets.UTF_8
        );

        // 프론트엔드 URL 결정
        String frontUrl = getRedirectOrigin(request, response);

        response.sendRedirect(
                frontUrl + "/oauth-fail?error=" + msg
        );
    }

    /**
     * 프론트엔드 리다이렉트 URL을 결정합니다.
     * 우선순위: 쿠키 > 설정값 > 환경변수 > 요청 기반 동적 생성
     */
    private String getRedirectOrigin(HttpServletRequest request, HttpServletResponse response) {
        String frontUrl = null;

        // 1순위: 쿠키에서 oauth_redirect_origin 읽기
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (OAuthRedirectOriginFilter.REDIRECT_ORIGIN_COOKIE.equals(cookie.getName())) {
                    frontUrl = cookie.getValue();
                    // 사용 후 쿠키 삭제 (SameSite=None; Secure로 삭제해야 함)
                    String deleteCookie = OAuthRedirectOriginFilter.REDIRECT_ORIGIN_COOKIE +
                            "=; Path=/; Max-Age=0; HttpOnly; SameSite=None; Secure";
                    response.addHeader("Set-Cookie", deleteCookie);
                    break;
                }
            }
        }

        // 2순위: application.properties의 app.frontend-url
        if (frontUrl == null || frontUrl.isEmpty()) {
            frontUrl = configuredFrontendUrl;
        }

        // 3순위: 환경 변수
        if (frontUrl == null || frontUrl.isEmpty()) {
            frontUrl = System.getenv("FRONTEND_URL");
            if (frontUrl == null || frontUrl.isEmpty()) {
                frontUrl = System.getenv("FRONTEND_ORIGIN");
            }
        }

        // 4순위: Request에서 동적 생성 (기본값)
        if (frontUrl == null || frontUrl.isEmpty()) {
            String scheme = request.getScheme();
            String hostname = request.getServerName();

            if (scheme.equals("https")) {
                frontUrl = scheme + "://" + hostname;
            } else {
                if (hostname.equals("localhost") || hostname.equals("127.0.0.1")) {
                    frontUrl = scheme + "://" + hostname + ":3000";
                } else {
                    frontUrl = scheme + "://" + hostname;
                }
            }
        }

        return frontUrl;
    }
}
