package com.example.demo.controller;

import com.example.demo.mypage.MyPageService;
import com.example.demo.mypage.MyPageVO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/mypage")
public class MyPageController {

    private final MyPageService myPageService;


    @GetMapping("/me")
    public ResponseEntity<MyPageVO> getMyPage(
            @RequestHeader("X-USER-ID") String userId
    ) {
        MyPageVO myPage = myPageService.getMyPage(userId);
        return ResponseEntity.ok(myPage);
    }


    @PutMapping("/me")
    public ResponseEntity<Void> updateMyPage(
            @RequestHeader("X-USER-ID") String userId,  // 임시 방식
            @RequestParam String name,
            @RequestParam String nickname,
            @RequestParam String birthDate,
            @RequestParam(required = false) String introduction,
            @RequestParam(required = false) MultipartFile profileImage
    ) {
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
}