package com.example.demo.controller;

import com.example.demo.auth.AuthService;
import com.example.demo.auth.AuthVO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @GetMapping("/check-email")
    public Map<String, Boolean> checkEmail(@RequestParam String email) {
        System.out.println("check-email 호출됨: " + email);

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

        return ResponseEntity.ok(
                Map.of(
                        "userId", user.getUserId(),
                        "nickname", user.getNickname()
                )
        );
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody AuthVO vo) {
        authService.signup(vo);
        return ResponseEntity.ok().build();
    }



}
