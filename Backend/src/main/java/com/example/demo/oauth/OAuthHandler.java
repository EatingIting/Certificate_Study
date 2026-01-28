package com.example.demo.oauth;

import com.example.demo.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

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

        // 🔥 프론트엔드 URL 동적 생성
        // 1순위: application.properties의 app.frontend-url
        String frontUrl = configuredFrontendUrl;
        if (frontUrl == null || frontUrl.isEmpty()) {
            // 2순위: 환경 변수 (FRONTEND_URL 또는 FRONTEND_ORIGIN)
            frontUrl = System.getenv("FRONTEND_URL");
            if (frontUrl == null || frontUrl.isEmpty()) {
                frontUrl = System.getenv("FRONTEND_ORIGIN");
            }
        }
        
        // 3순위: Referer 헤더에서 프론트엔드 URL 추출
        if (frontUrl == null || frontUrl.isEmpty()) {
            String referer = request.getHeader("Referer");
            if (referer != null && !referer.isEmpty()) {
                try {
                    java.net.URL refererUrl = new java.net.URL(referer);
                    String refererOrigin = refererUrl.getProtocol() + "://" + refererUrl.getHost();
                    int refererPort = refererUrl.getPort();
                    if (refererPort != -1 && refererPort != 80 && refererPort != 443) {
                        refererOrigin += ":" + refererPort;
                    }
                    frontUrl = refererOrigin;
                } catch (Exception e) {
                    // Referer 파싱 실패 시 무시
                }
            }
        }
        
        // 4순위: Origin 헤더 사용
        if (frontUrl == null || frontUrl.isEmpty()) {
            String origin = request.getHeader("Origin");
            if (origin != null && !origin.isEmpty()) {
                frontUrl = origin;
            }
        }
        
        // 5순위: Request에서 동적 생성 (기본값)
        if (frontUrl == null || frontUrl.isEmpty()) {
            String scheme = request.getScheme();
            String hostname = request.getServerName();
            int serverPort = request.getServerPort();
            
            // HTTPS는 기본적으로 포트 없이, HTTP는 3000 포트 사용 (localhost 개발 환경)
            if (scheme.equals("https")) {
                frontUrl = scheme + "://" + hostname;
            } else {
                // HTTP인 경우: localhost면 3000, 그 외에는 포트 없이
                if (hostname.equals("localhost") || hostname.equals("127.0.0.1")) {
                    frontUrl = scheme + "://" + hostname + ":3000";
                } else {
                    // 프로덕션 환경 (172.30.1.250 등)은 포트 없이
                    frontUrl = scheme + "://" + hostname;
                }
            }
        }

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
}
