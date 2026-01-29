package com.example.demo.oauth;

import com.example.demo.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.Cookie;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuthHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.frontend-url:}")
    private String configuredFrontendUrl;

    public OAuthHandler(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication)
            throws IOException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

        String email = oauthUser.getAttribute("email");
        Boolean exists = oauthUser.getAttribute("exists");
        String provider = oauthUser.getAttribute("provider");

        // 프론트엔드 URL 결정
        String frontUrl = getRedirectOrigin(request, response);

        if (exists != null && exists) {

            String token = jwtTokenProvider.createAccessToken(email);

            response.sendRedirect(
                    frontUrl + "/oauth-success?token=" + token
            );
        }

        else {

            String encodedEmail = URLEncoder.encode(
                    email,
                    StandardCharsets.UTF_8
            );

            response.sendRedirect(
                    frontUrl + "/signup"
                            + "?email=" + encodedEmail
                            + "&provider=" + provider
            );
        }
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
