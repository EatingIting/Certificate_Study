package com.example.demo.모집.service;

import com.example.demo.모집.mapper.RoomListMapper;
import com.example.demo.모집.vo.RoomListVO;
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

        // 자식 테이블 먼저 삭제
        roomListMapper.deleteBoardPostsByRoomId(roomId);
        roomListMapper.deleteJoinRequestsByRoomId(roomId);
        roomListMapper.deleteSchedulesByRoomId(roomId);

        // 마지막에 부모 삭제
        roomListMapper.deleteRoom(roomId);
    }

    @Transactional
    public List<RoomListVO> getInterestRooms(List<Long> categoryIds) {

        if (categoryIds == null || categoryIds.isEmpty()) {
            return List.of(); // 관심없으면 빈 리스트
        }

        return roomListMapper.selectRoomsByCategoryIds(categoryIds);
    }
}
