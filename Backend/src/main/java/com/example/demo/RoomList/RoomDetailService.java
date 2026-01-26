package com.example.demo.RoomList;

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