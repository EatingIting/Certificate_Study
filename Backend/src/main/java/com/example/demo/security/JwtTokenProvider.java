package com.example.demo.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import io.jsonwebtoken.Claims;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.List;

@Component
public class JwtTokenProvider {

    private final Algorithm algorithm;
    private final String issuer;
    private final long expirationMs;

    // 생성자: properties 값 주입 + Algorithm 생성
    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.issuer}") String issuer,
            @Value("${jwt.expiration-ms}") long expirationMs
    ) {
        this.algorithm = Algorithm.HMAC256(secret);
        this.issuer = issuer;
        this.expirationMs = expirationMs;
    }

    // 토큰 발급 메서드
    public String createAccessToken(String loginId) {
        Date now = new Date();
        Date expiresAt = new Date(now.getTime() + expirationMs);

        return JWT.create() // 토큰 생성 시작
                .withIssuer(issuer) // 발급자 설정
                .withSubject(loginId) // 토큰 주인(여기선 loginId)
                .withIssuedAt(now) // 발급시간
                .withExpiresAt(expiresAt) //만료시간
                .sign(algorithm);
    }

    public Authentication getAuthentication(String token) {

        DecodedJWT decodedJWT = JWT.require(algorithm)
                .withIssuer(issuer)
                .build()
                .verify(token);

        String loginId = decodedJWT.getSubject();

        return new UsernamePasswordAuthenticationToken(
                loginId,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
    }
}