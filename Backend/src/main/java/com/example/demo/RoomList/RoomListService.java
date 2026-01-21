package com.example.demo.RoomList;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomListService {

    private final RoomListMapper roomListMapper;

    public List<RoomListVO> getRooms() {
        return roomListMapper.selectRoomList();
    }
}