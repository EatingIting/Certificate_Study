package com.example.demo.oauth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * OAuth2 redirect_uri가 카카오/구글/네이버에 등록한 URL과 일치하도록
 * app.oauth2.base-url(예: https://onsil.study) 설정 시 요청의 scheme/host를 덮어씁니다.
 * Nginx에서 X-Forwarded-Proto/Host를 전달하지 않을 때 사용합니다.
 */
@Component
@Order(-100)
public class OAuth2BaseUrlRequestFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(OAuth2BaseUrlRequestFilter.class);

    @Value("${app.oauth2.base-url:}")
    private String baseUrl;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (baseUrl == null || baseUrl.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        String uri = request.getRequestURI();
        boolean isOAuth2 = uri.startsWith("/oauth2/authorization/") || uri.startsWith("/login/oauth2/code/");
        if (!isOAuth2) {
            filterChain.doFilter(request, response);
            return;
        }

        URI parsed;
        try {
            parsed = new URI(baseUrl.trim());
        } catch (URISyntaxException e) {
            log.warn("[OAuth2BaseUrl] invalid app.oauth2.base-url: {}", baseUrl);
            filterChain.doFilter(request, response);
            return;
        }

        String scheme = parsed.getScheme() != null ? parsed.getScheme() : "https";
        String host = parsed.getHost();
        int port = parsed.getPort();

        if (host == null || host.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        HttpServletRequest wrapped = new HttpServletRequestWrapper(request) {
            @Override
            public String getScheme() {
                return scheme;
            }
            @Override
            public String getServerName() {
                return host;
            }
            @Override
            public int getServerPort() {
                if (port > 0) return port;
                return "https".equalsIgnoreCase(scheme) ? 443 : 80;
            }
        };

        log.debug("[OAuth2BaseUrl] wrapped request for {} -> {}://{}", uri, scheme, host);
        filterChain.doFilter(wrapped, response);
    }
}
