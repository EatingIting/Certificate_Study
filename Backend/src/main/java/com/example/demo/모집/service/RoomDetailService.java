package com.example.demo.모집.service;

import com.example.demo.모집.mapper.RoomDetailMapper;
import com.example.demo.모집.vo.RoomDetailVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoomDetailService {

    private final RoomDetailMapper roomDetailMapper;

    public RoomDetailVO getRoomDetail(String roomId) {
        return roomDetailMapper.selectRoomDetail(roomId);
    }
}