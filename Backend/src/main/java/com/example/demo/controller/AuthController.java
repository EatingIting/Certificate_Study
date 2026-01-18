package com.example.demo.controller;

import com.example.demo.auth.AuthService;
import com.example.demo.auth.AuthVO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class AuthController {

    private final AuthService authService;

    @GetMapping("/check-email")
    public Map<String, Boolean> checkEmail(@RequestParam String email) {
        System.out.println("check-email 호출됨: " + email);

        boolean available = authService.isEmailAvailable(email);

        return Map.of("available", available);
    }

    @PostMapping("/signup")
    public ResponseEntity<Void> signup(@RequestBody AuthVO authVO) {
        authService.signup(authVO);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(
            @RequestBody Map<String, String> request
    ) {
        System.out.println("🔥 로그인 컨트롤러 진입");
        String token = authService.login(
                request.get("email"),
                request.get("password")
        );

        return ResponseEntity.ok(
                Map.of("accessToken", token)
        );
    }
}
