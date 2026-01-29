package com.example.demo.controller;

import com.example.demo.RoomList.RoomDetailService;
import com.example.demo.RoomList.RoomDetailVO;
import com.example.demo.RoomList.RoomListService;
import com.example.demo.RoomList.RoomListVO;
import com.example.demo.auth.AuthMapper;
import com.example.demo.auth.AuthVO;
import com.example.demo.userinterestcategory.UserInterestCategoryService;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomListService roomListService;
    private final RoomDetailService roomDetailService;

    // ⭐ 추가 주입 필요
    private final AuthMapper authMapper;
    private final UserInterestCategoryService interestService;

    // 최신 모집 스터디 리스트
    @GetMapping
    public List<RoomListVO> getRooms() {
        return roomListService.getRooms();
    }

    // 방 상세보기
    @GetMapping("/{roomId}")
    public RoomDetailVO getRoomDetail(@PathVariable String roomId) {
        return roomDetailService.getRoomDetail(roomId);
    }

    // 방 삭제
    @DeleteMapping("/{roomId}")
    public void deleteRoom(@PathVariable String roomId) {
        roomListService.deleteRoom(roomId);
    }
}
