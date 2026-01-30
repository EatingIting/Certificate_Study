package com.example.demo.모집.controller;

import com.example.demo.모집.service.RoomListService;
import com.example.demo.모집.vo.RoomListVO;
import com.example.demo.로그인.mapper.AuthMapper;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.모집.service.MainService;
import com.example.demo.모집.vo.MainVO;
import com.example.demo.마이페이지.service.UserInterestCategoryService;
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
