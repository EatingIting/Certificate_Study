package com.example.demo.RoomList;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomListService {

    private final RoomListMapper roomListMapper;

    @Transactional
    public List<RoomListVO> getRooms() {

        roomListMapper.closeExpiredRooms();

        roomListMapper.closeFullRooms();

        return roomListMapper.selectRoomList();

    }

    @Transactional
    public void deleteRoom(String roomId) {
        roomListMapper.deleteRoom(roomId);
    }

}
