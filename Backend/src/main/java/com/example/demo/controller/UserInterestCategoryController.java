package com.example.demo.controller;

import com.example.demo.auth.AuthMapper;
import com.example.demo.auth.AuthVO;
import com.example.demo.userinterestcategory.UserInterestCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/mypage/interests")
public class UserInterestCategoryController {

    private final UserInterestCategoryService service;
    private final AuthMapper authMapper;

    // ✅ 관심카테고리 조회
    @GetMapping
    public List<Long> getMyInterests(Authentication authentication) {

        // JWT subject = email
        String email = authentication.getName();

        // email → userId 변환
        AuthVO user = authMapper.findByEmail(email);

        return service.getInterestCategories(user.getUserId());
    }

    // ✅ 관심카테고리 수정
    @PutMapping
    public void updateMyInterests(
            Authentication authentication,
            @RequestBody List<Long> categoryIds
    ) {
        String email = authentication.getName();

        AuthVO user = authMapper.findByEmail(email);

        service.updateInterestCategories(user.getUserId(), categoryIds);
    }
}