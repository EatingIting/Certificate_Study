package com.example.demo.controller;

import com.example.demo.mypage.MyPageService;
import com.example.demo.mypage.MyPageVO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/mypage")
public class MyPageController {

    private final MyPageService myPageService;

    @GetMapping("/me")
    public ResponseEntity<MyPageVO> getMyPage(Authentication authentication) {
        String userId = (String) authentication.getPrincipal();

        MyPageVO myPage = myPageService.getMyPage(userId);
        return ResponseEntity.ok(myPage);
    }

    @PutMapping("/me")
    public ResponseEntity<Void> updateMyPage(
            Authentication authentication,
            @RequestParam String name,
            @RequestParam String nickname,
            @RequestParam String birthDate,
            @RequestParam(required = false) String introduction,
            @RequestParam(required = false) MultipartFile profileImage
    ) {
        String userId = (String) authentication.getPrincipal();

        myPageService.updateMyPage(
                userId,
                name,
                nickname,
                birthDate,
                introduction,
                profileImage
        );

        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> withdraw(Authentication authentication) {

        String email = authentication.getName();

        myPageService.withdraw(email);

        return ResponseEntity.ok().build();
    }
}
