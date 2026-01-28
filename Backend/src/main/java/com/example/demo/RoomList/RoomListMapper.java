package com.example.demo.RoomList;

import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface RoomListMapper {

    // 모집 리스트 조회 (OPEN만)
    List<RoomListVO> selectRoomList();

    int closeExpiredRooms();

    int closeFullRooms();

    void deleteRoom(String roomId);
}
