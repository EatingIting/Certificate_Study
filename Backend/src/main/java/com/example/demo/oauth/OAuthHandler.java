package com.example.demo.oauth;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.jwt.RefreshTokenCookieService;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class OAuthHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuthHandler.class);

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenCookieService refreshTokenCookieService;

    @Value("${app.frontend-url:}")
    private String configuredFrontendUrl;

    public OAuthHandler(
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenCookieService refreshTokenCookieService
    ) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenCookieService = refreshTokenCookieService;
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

            String refreshToken = jwtTokenProvider.createRefreshToken(email, true);
            refreshTokenCookieService.addRefreshTokenCookie(
                    request,
                    response,
                    refreshToken,
                    true
            );

            response.sendRedirect(
                    frontUrl + "/oauth-success"
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
        log.info("[OAuthHandler] 쿠키 개수: {}", cookies != null ? cookies.length : 0);
        log.info("[OAuthHandler] Request URI: {}, Scheme: {}, ServerName: {}, Host: {}", 
                request.getRequestURI(), request.getScheme(), request.getServerName(), request.getHeader("Host"));
        
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                log.info("[OAuthHandler] 쿠키: {} = {} (Domain: {}, Path: {})", 
                        cookie.getName(), cookie.getValue(), cookie.getDomain(), cookie.getPath());
                if (OAuthRedirectOriginFilter.REDIRECT_ORIGIN_COOKIE.equals(cookie.getName())) {
                    // 쿠키 값 디코딩 (인코딩된 경우)
                    try {
                        frontUrl = java.net.URLDecoder.decode(cookie.getValue(), StandardCharsets.UTF_8);
                    } catch (Exception e) {
                        frontUrl = cookie.getValue(); // 디코딩 실패 시 원본 사용
                    }
                    log.info("[OAuthHandler] redirect_origin 쿠키 발견: {}", frontUrl);
                    // 사용 후 쿠키 삭제 (HTTPS/HTTP에 맞게)
                    StringBuilder deleteCookie = new StringBuilder();
                    deleteCookie.append(OAuthRedirectOriginFilter.REDIRECT_ORIGIN_COOKIE);
                    deleteCookie.append("=; Path=/; Max-Age=0; HttpOnly");
                    if (OAuthRedirectOriginFilter.isSecureRequest(request)) {
                        deleteCookie.append("; SameSite=None; Secure");
                    } else {
                        deleteCookie.append("; SameSite=Lax");
                    }
                    response.addHeader("Set-Cookie", deleteCookie.toString());
                    break;
                }
            }
        } else {
            log.warn("[OAuthHandler] 쿠키가 없습니다!");
        }

        // 2순위: 환경 변수는 동적 감지 이후에만 사용 (쿠키가 없을 때 동적 감지 우선)
        // 환경 변수는 개발/프로덕션 환경별로 고정값이 필요할 때만 사용
        // 동적 감지가 실패한 경우에만 환경 변수 사용

        // 4순위: Origin 헤더에서 추출 (OAuth 제공자 도메인이 아닌 경우만)
        if (frontUrl == null || frontUrl.isEmpty()) {
            String origin = request.getHeader("Origin");
            log.info("[OAuthHandler] 4순위 시도 - Origin: {}", origin);
            
            if (origin != null && !origin.isEmpty()) {
                try {
                    java.net.URL originUrl = new java.net.URL(origin);
                    String originHost = originUrl.getHost();
                    
                    // OAuth 제공자 도메인이 아닌 경우에만 사용
                    if (!isOAuthProviderDomain(originHost)) {
                        frontUrl = origin;
                        log.info("[OAuthHandler] Origin에서 추출한 URL: {}", frontUrl);
                    } else {
                        log.warn("[OAuthHandler] Origin이 OAuth 제공자 도메인입니다: {}", originHost);
                    }
                } catch (Exception e) {
                    log.warn("[OAuthHandler] Origin 파싱 실패: {}", e.getMessage());
                }
            }
        }

        // 5순위: Referer 헤더에서 추출 (OAuth 콜백 시 원래 프론트엔드 URL 추정)
        if (frontUrl == null || frontUrl.isEmpty()) {
            String referer = request.getHeader("Referer");
            log.info("[OAuthHandler] 5순위 시도 - Referer: {}", referer);
            
            if (referer != null && !referer.isEmpty()) {
                try {
                    java.net.URL refererUrl = new java.net.URL(referer);
                    String refererHost = refererUrl.getHost();
                    String refererScheme = refererUrl.getProtocol();
                    
                    // OAuth 제공자 도메인이 아닌 경우에만 사용
                    if (!isOAuthProviderDomain(refererHost)) {
                        String backendHost = request.getServerName();
                        if (!refererHost.equals(backendHost) && !refererHost.equals("localhost") && !refererHost.equals("127.0.0.1")) {
                            if (refererScheme.equals("https")) {
                                frontUrl = refererScheme + "://" + refererHost;
                            } else {
                                int port = refererUrl.getPort();
                                if (port == -1) {
                                    frontUrl = refererScheme + "://" + refererHost;
                                } else {
                                    frontUrl = refererScheme + "://" + refererHost + ":" + port;
                                }
                            }
                            log.info("[OAuthHandler] Referer에서 추출한 URL: {}", frontUrl);
                        } else if (refererHost.equals("localhost") || refererHost.equals("127.0.0.1")) {
                            // localhost인 경우 포트 확인
                            int port = refererUrl.getPort();
                            if (port > 0 && port != request.getServerPort()) {
                                // 프론트엔드 포트가 백엔드 포트와 다른 경우
                                frontUrl = refererScheme + "://" + refererHost + ":" + port;
                                log.info("[OAuthHandler] Referer에서 추출한 URL (포트 포함): {}", frontUrl);
                            }
                        }
                    } else {
                        log.warn("[OAuthHandler] Referer가 OAuth 제공자 도메인입니다: {}", refererHost);
                    }
                } catch (Exception e) {
                    log.warn("[OAuthHandler] Referer 파싱 실패: {}", e.getMessage());
                }
            }
        }

        // 6순위: Request에서 동적 생성 (현재 요청의 호스트 기반)
        if (frontUrl == null || frontUrl.isEmpty()) {
            String scheme = request.getScheme();
            String hostname = request.getServerName();
            String hostHeader = request.getHeader("Host");
            
            log.info("[OAuthHandler] 5순위 fallback - scheme: {}, hostname: {}, Host header: {}", 
                    scheme, hostname, hostHeader);
            
            // Host 헤더가 있으면 우선 사용 (프록시 환경 대응)
            if (hostHeader != null && !hostHeader.isEmpty()) {
                // Host 헤더에서 포트 제거 (프론트엔드는 별도 포트 사용)
                String hostWithoutPort = hostHeader.split(":")[0];
                
                // HTTPS인 경우 포트 없이, HTTP인 경우 localhost면 :3000 추가
                if (scheme.equals("https")) {
                    frontUrl = scheme + "://" + hostWithoutPort;
                } else {
                    if (hostWithoutPort.equals("localhost") || hostWithoutPort.equals("127.0.0.1")) {
                        frontUrl = scheme + "://" + hostWithoutPort + ":3000";
                    } else {
                        // 다른 도메인인 경우 포트 없이 (프론트엔드가 같은 포트를 사용한다고 가정)
                        frontUrl = scheme + "://" + hostWithoutPort;
                    }
                }
            } else {
                // Host 헤더가 없는 경우
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
            log.info("[OAuthHandler] 5순위 fallback 결과: {}", frontUrl);
        }
        
        // 최종 fallback: 환경 변수 또는 설정값 (동적 감지가 모두 실패한 경우에만)
        if (frontUrl == null || frontUrl.isEmpty()) {
            frontUrl = System.getenv("FRONTEND_URL");
            if (frontUrl == null || frontUrl.isEmpty()) {
                frontUrl = System.getenv("FRONTEND_ORIGIN");
            }
            if (frontUrl != null && !frontUrl.isEmpty()) {
                log.info("[OAuthHandler] 최종 fallback - 환경변수 사용: {}", frontUrl);
            } else if (configuredFrontendUrl != null && !configuredFrontendUrl.isEmpty()) {
                frontUrl = configuredFrontendUrl;
                log.info("[OAuthHandler] 최종 fallback - app.frontend-url 사용: {}", frontUrl);
            }
        }

        log.info("[OAuthHandler] 최종 리다이렉트 URL: {}", frontUrl);
        return frontUrl;
    }

    /**
     * OAuth 제공자 도메인인지 확인
     */
    private boolean isOAuthProviderDomain(String host) {
        if (host == null || host.isEmpty()) {
            return false;
        }
        
        // 네이버, 카카오, 구글 OAuth 제공자 도메인 체크
        return host.contains("naver.com") || 
               host.contains("nid.naver.com") ||
               host.contains("kakao.com") ||
               host.contains("kauth.kakao.com") ||
               host.contains("kapi.kakao.com") ||
               host.contains("google.com") ||
               host.contains("accounts.google.com") ||
               host.contains("oauth2.googleapis.com");
    }
}
