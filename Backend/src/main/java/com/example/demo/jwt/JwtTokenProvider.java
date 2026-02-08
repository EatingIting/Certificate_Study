package com.example.demo.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

@Component
public class JwtTokenProvider {

    private static final String TOKEN_TYPE_CLAIM = "typ";
    private static final String REFRESH_TOKEN_TYPE = "refresh";
    private static final String REMEMBER_ME_CLAIM = "rememberMe";

    private final SecretKey accessKey;
    private final SecretKey refreshKey;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String accessSecret,
            @Value("${jwt.refresh-secret}") String refreshSecret,
            @Value("${jwt.expiration-ms}") long accessExpirationMs,
            @Value("${jwt.refresh-expiration-ms}") long refreshExpirationMs
    ) {
        this.accessKey = Keys.hmacShaKeyFor(accessSecret.getBytes(StandardCharsets.UTF_8));
        this.refreshKey = Keys.hmacShaKeyFor(refreshSecret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    public String createAccessToken(String email) {
        Date now = new Date();

        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + accessExpirationMs))
                .signWith(accessKey)
                .compact();
    }

    public String createRefreshToken(String email, boolean rememberMe) {
        Date now = new Date();

        return Jwts.builder()
                .setSubject(email)
                .claim(TOKEN_TYPE_CLAIM, REFRESH_TOKEN_TYPE)
                .claim(REMEMBER_ME_CLAIM, rememberMe)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + refreshExpirationMs))
                .signWith(refreshKey)
                .compact();
    }

    // Backward-compatible alias used by existing filter code.
    public boolean validateToken(String token) {
        return validateAccessToken(token);
    }

    public boolean validateAccessToken(String token) {
        return parseClaimsSafely(token, accessKey) != null;
    }

    public boolean validateRefreshToken(String token) {
        Claims claims = parseClaimsSafely(token, refreshKey);
        if (claims == null) {
            return false;
        }
        return REFRESH_TOKEN_TYPE.equals(claims.get(TOKEN_TYPE_CLAIM, String.class));
    }

    public String getEmailFromRefreshToken(String refreshToken) {
        Claims claims = parseClaimsOrThrow(refreshToken, refreshKey);
        return claims.getSubject();
    }

    public boolean isRefreshTokenPersistent(String refreshToken) {
        Claims claims = parseClaimsOrThrow(refreshToken, refreshKey);
        Boolean rememberMe = claims.get(REMEMBER_ME_CLAIM, Boolean.class);
        return Boolean.TRUE.equals(rememberMe);
    }

    public Authentication getAuthentication(String token) {
        Claims claims = parseClaimsOrThrow(token, accessKey);
        String email = claims.getSubject();

        return new UsernamePasswordAuthenticationToken(
                email,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
    }

    private Claims parseClaimsSafely(String token, SecretKey key) {
        try {
            return Jwts.parser()
                    .setSigningKey(key)
                    .parseClaimsJws(token)
                    .getBody();
        } catch (Exception e) {
            return null;
        }
    }

    private Claims parseClaimsOrThrow(String token, SecretKey key) {
        return Jwts.parser()
                .setSigningKey(key)
                .parseClaimsJws(token)
                .getBody();
    }
}
