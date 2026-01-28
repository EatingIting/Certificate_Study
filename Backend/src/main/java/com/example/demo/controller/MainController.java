package com.example.demo.controller;

import com.example.demo.RoomList.RoomListService;
import com.example.demo.RoomList.RoomListVO;
import com.example.demo.auth.AuthMapper;
import com.example.demo.auth.AuthVO;
import com.example.demo.main.MainService;
import com.example.demo.main.MainVO;
import com.example.demo.userinterestcategory.UserInterestCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/main")
public class MainController {

    private final MainService mainService;

    private final AuthMapper authMapper;
    private final UserInterestCategoryService userInterestCategoryService;
    private final RoomListService roomListService;

    // 최신 모집방
    @GetMapping("/rooms")
    public List<MainVO> mainRooms() {
        return mainService.getMainRooms();
    }

    // 관심 자격증 기반 추천방
    @GetMapping("/interest")
    public List<RoomListVO> getInterestRooms(Authentication authentication) {

        System.out.println("authentication = " + authentication);

        if (authentication == null) {
            throw new RuntimeException("로그인이 필요합니다.");
        }

        String email = authentication.getName();

        AuthVO user = authMapper.findByEmail(email);

        if (user == null) {
            throw new RuntimeException("유저 정보 없음");
        }

        List<Long> interests =
                userInterestCategoryService.getInterestCategories(user.getUserId());

        return roomListService.getInterestRooms(interests);
    }

}
