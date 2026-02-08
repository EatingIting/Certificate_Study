package com.example.demo.로그인.controller;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.jwt.RefreshTokenCookieService;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenCookieService refreshTokenCookieService;

    @GetMapping("/check-email")
    public Map<String, Boolean> checkEmail(@RequestParam String email) {

        boolean available = authService.isEmailAvailable(email);

        return Map.of("available", available);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String email = request.get("email") != null ? request.get("email").toString() : null;
        String password = request.get("password") != null ? request.get("password").toString() : null;
        boolean rememberMe = readBoolean(request.get("rememberMe"));

        AuthVO user = authService.login(email, password);

        String accessToken = jwtTokenProvider.createAccessToken(user.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getEmail(), rememberMe);

        refreshTokenCookieService.addRefreshTokenCookie(
                httpRequest,
                httpResponse,
                refreshToken,
                rememberMe
        );

        Map<String, String> response = new HashMap<>();
        response.put("userId", user.getUserId());
        response.put("nickname", user.getNickname() != null ? user.getNickname() : "");
        response.put("name", user.getName() != null ? user.getName() : "");
        response.put("email", user.getEmail());
        response.put("token", accessToken);
        response.put("accessToken", accessToken);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String refreshToken = refreshTokenCookieService.resolveRefreshToken(request);
        if (refreshToken == null || !jwtTokenProvider.validateRefreshToken(refreshToken)) {
            refreshTokenCookieService.clearRefreshTokenCookie(request, response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String email;
        boolean rememberMe;
        try {
            email = jwtTokenProvider.getEmailFromRefreshToken(refreshToken);
            rememberMe = jwtTokenProvider.isRefreshTokenPersistent(refreshToken);
        } catch (Exception e) {
            refreshTokenCookieService.clearRefreshTokenCookie(request, response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        AuthVO user = authService.findByEmail(email);
        if (user == null) {
            refreshTokenCookieService.clearRefreshTokenCookie(request, response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String newAccessToken = jwtTokenProvider.createAccessToken(email);
        String newRefreshToken = jwtTokenProvider.createRefreshToken(email, rememberMe);

        refreshTokenCookieService.addRefreshTokenCookie(
                request,
                response,
                newRefreshToken,
                rememberMe
        );

        Map<String, String> body = new HashMap<>();
        body.put("token", newAccessToken);
        body.put("accessToken", newAccessToken);
        body.put("userId", user.getUserId());
        body.put("nickname", user.getNickname() != null ? user.getNickname() : "");
        body.put("name", user.getName() != null ? user.getName() : "");
        body.put("email", user.getEmail());

        return ResponseEntity.ok(body);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        refreshTokenCookieService.clearRefreshTokenCookie(request, response);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody AuthVO vo) {
        authService.signup(vo);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyInfo(Authentication authentication) {

        String email = authentication.getName();

        AuthVO user = authService.findByEmail(email);

        Map<String, String> response = new HashMap<>();
        response.put("userId", user.getUserId());
        response.put("email", user.getEmail());
        response.put("name", user.getName() != null ? user.getName() : "");
        response.put("nickname", user.getNickname() != null ? user.getNickname() : "");

        return ResponseEntity.ok(response);
    }

    private boolean readBoolean(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (value == null) {
            return false;
        }
        return Boolean.parseBoolean(value.toString());
    }
}
