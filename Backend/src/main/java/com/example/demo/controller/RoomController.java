package com.example.demo.controller;

import com.example.demo.RoomList.RoomDetailService;
import com.example.demo.RoomList.RoomDetailVO;
import com.example.demo.RoomList.RoomListService;
import com.example.demo.RoomList.RoomListVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomListService roomListService;
    private final RoomDetailService roomDetailService;

    @GetMapping
    public List<RoomListVO> getRooms() {
        return roomListService.getRooms();
    }

    @GetMapping("/{roomId}")
    public RoomDetailVO getRoomDetail(@PathVariable String roomId) {
        return roomDetailService.getRoomDetail(roomId);
    }
}
