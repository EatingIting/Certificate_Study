package com.example.demo.마이페이지.controller;

import com.example.demo.로그인.mapper.AuthMapper;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.마이페이지.service.UserInterestCategoryService;
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

    @GetMapping
    public List<Long> getMyInterests(Authentication authentication) {

        // JWT subject = email
        String email = authentication.getName();

        // email → userId 변환
        AuthVO user = authMapper.findByEmail(email);

        return service.getInterestCategories(user.getUserId());
    }

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