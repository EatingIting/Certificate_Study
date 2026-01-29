package com.example.demo.로그인.controller;

import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping("/check-email")
    public Map<String, Boolean> checkEmail(@RequestParam String email) {

        boolean available = authService.isEmailAvailable(email);

        return Map.of("available", available);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(
            @RequestBody Map<String, String> request
    ) {
        AuthVO user = authService.login(
                request.get("email"),
                request.get("password")
        );

        String token = jwtTokenProvider.createAccessToken(user.getEmail());

        return ResponseEntity.ok(
                Map.of(
                        "userId", user.getUserId(),
                        "nickname", user.getNickname(),
                        "token", token
                )
        );
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody AuthVO vo) {
        authService.signup(vo);
        return ResponseEntity.ok().build();
    }

    // OAuth 로그인 후 nickname 가져오는 API
    @GetMapping("/me")
    public ResponseEntity<?> getMyInfo(Authentication authentication) {

        String email = authentication.getName();

        AuthVO user = authService.findByEmail(email);

        return ResponseEntity.ok(
                Map.of(
                        "userId", user.getUserId(),
                        "email", user.getEmail(),
                        "nickname", user.getNickname()
                )
        );
    }
}
