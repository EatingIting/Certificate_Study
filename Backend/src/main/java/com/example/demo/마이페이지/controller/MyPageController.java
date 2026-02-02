package com.example.demo.마이페이지.controller;

import com.example.demo.로그인.mapper.AuthMapper;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.마이페이지.service.MyPageService;
import com.example.demo.마이페이지.vo.MyPageVO;
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
    private final AuthMapper authMapper;

    @GetMapping("/me")
    public ResponseEntity<MyPageVO> getMyPage(Authentication authentication) {
        // ✅ JWT의 principal은 email이므로, email → userId 변환 필요
        String email = authentication.getName();
        AuthVO user = authMapper.findByEmail(email);
        
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        
        String userId = user.getUserId();
        MyPageVO myPage = myPageService.getMyPage(userId);
        return ResponseEntity.ok(myPage);
    }

    @PutMapping("/me")
    public ResponseEntity<Void> updateMyPage(
            Authentication authentication,
            @RequestParam String name,
            @RequestParam String nickname,
            @RequestParam String birthDate,
            @RequestParam String gender,
            @RequestParam(required = false) String introduction,
            @RequestParam(required = false) MultipartFile profileImage
    ) {
        // ✅ JWT의 principal은 email이므로, email → userId 변환 필요
        String email = authentication.getName();
        AuthVO user = authMapper.findByEmail(email);
        
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        
        String userId = user.getUserId();

        myPageService.updateMyPage(
                userId,
                name,
                nickname,
                birthDate,
                gender,
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

    @GetMapping("/me/gender")
    public ResponseEntity<String> getMyGender(Authentication authentication) {

        String email = authentication.getName();

        String gender = myPageService.getGender(email);

        return ResponseEntity.ok(gender);
    }

    @GetMapping("/me/studies/joined")
    public ResponseEntity<?> getJoinedStudies(Authentication authentication) {

        String email = authentication.getName();

        return ResponseEntity.ok(
                myPageService.getJoinedStudies(email)
        );
    }

    @GetMapping("/me/studies/completed")
    public ResponseEntity<?> getCompletedStudies(Authentication authentication) {

        String email = authentication.getName();

        return ResponseEntity.ok(
                myPageService.getCompletedStudies(email)
        );
    }




}
