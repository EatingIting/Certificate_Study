package com.example.demo.oauth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.SerializationUtils;

import java.util.Base64;

/**
 * OAuth2 인증 요청을 쿠키에 저장하는 Repository
 * STATELESS 세션 정책에서도 OAuth2 인증이 작동하도록 함
 */
@Component
public class HttpCookieOAuth2AuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    public static final String OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME = "oauth2_auth_request";
    private static final int COOKIE_EXPIRE_SECONDS = 180;

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return getCookie(request, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME)
                .map(cookie -> deserialize(cookie, OAuth2AuthorizationRequest.class))
                .orElse(null);
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        if (authorizationRequest == null) {
            deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
            return;
        }

        String cookieValue = serialize(authorizationRequest);

        // 쿠키 설정: HTTPS에서는 SameSite=None; Secure, HTTP에서는 SameSite=Lax
        StringBuilder cookieBuilder = new StringBuilder();
        cookieBuilder.append(OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME).append("=").append(cookieValue);
        cookieBuilder.append("; Path=/");
        cookieBuilder.append("; Max-Age=").append(COOKIE_EXPIRE_SECONDS);
        cookieBuilder.append("; HttpOnly");

        if (OAuthRedirectOriginFilter.isSecureRequest(request)) {
            // HTTPS: cross-site에서도 쿠키 전송 (시크릿 모드 포함)
            cookieBuilder.append("; SameSite=None");
            cookieBuilder.append("; Secure");
        } else {
            // HTTP (localhost 개발환경): SameSite=Lax
            cookieBuilder.append("; SameSite=Lax");
        }

        response.addHeader("Set-Cookie", cookieBuilder.toString());
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
                                                                  HttpServletResponse response) {
        OAuth2AuthorizationRequest authorizationRequest = loadAuthorizationRequest(request);
        if (authorizationRequest != null) {
            deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
        }
        return authorizationRequest;
    }

    private java.util.Optional<Cookie> getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (name.equals(cookie.getName())) {
                    return java.util.Optional.of(cookie);
                }
            }
        }
        return java.util.Optional.empty();
    }

    private void deleteCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        StringBuilder cookieBuilder = new StringBuilder();
        cookieBuilder.append(name).append("=");
        cookieBuilder.append("; Path=/");
        cookieBuilder.append("; Max-Age=0");
        cookieBuilder.append("; HttpOnly");

        if (OAuthRedirectOriginFilter.isSecureRequest(request)) {
            cookieBuilder.append("; SameSite=None");
            cookieBuilder.append("; Secure");
        } else {
            cookieBuilder.append("; SameSite=Lax");
        }

        response.addHeader("Set-Cookie", cookieBuilder.toString());
    }

    private String serialize(Object object) {
        return Base64.getUrlEncoder().encodeToString(SerializationUtils.serialize(object));
    }

    private <T> T deserialize(Cookie cookie, Class<T> cls) {
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(cookie.getValue());
            return cls.cast(SerializationUtils.deserialize(bytes));
        } catch (Exception e) {
            return null;
        }
    }
}
