package com.example.demo.로그인.controller;

import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
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

        // HashMap을 사용하여 name 필드가 항상 포함되도록 함
        Map<String, String> response = new HashMap<>();
        response.put("userId", user.getUserId());
        response.put("nickname", user.getNickname() != null ? user.getNickname() : "");
        response.put("name", user.getName() != null ? user.getName() : "");
        response.put("token", token);

        return ResponseEntity.ok(response);
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
        
        // 디버깅을 위한 로그
        System.out.println("User email: " + email);
        System.out.println("User name: " + user.getName());
        System.out.println("User nickname: " + user.getNickname());

        // HashMap을 사용하여 name 필드가 항상 포함되도록 함
        Map<String, String> response = new HashMap<>();
        response.put("userId", user.getUserId());
        response.put("email", user.getEmail());
        response.put("name", user.getName() != null ? user.getName() : "");
        response.put("nickname", user.getNickname() != null ? user.getNickname() : "");

        return ResponseEntity.ok(response);
    }
}
