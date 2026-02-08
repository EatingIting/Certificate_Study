package com.example.demo.모집.mapper;

import com.example.demo.모집.vo.RoomListVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RoomListMapper {

    // 모집 리스트 조회 (OPEN만)
    List<RoomListVO> selectRoomList();
    int closeExpiredRooms();

    int closeFullRooms();

    void deleteRoom(String roomId);

    void deleteSchedulesByRoomId(String roomId);
    void deleteJoinRequestsByRoomId(String roomId);
    void deleteBoardPostsByRoomId(String roomId);

    List<RoomListVO> selectRoomsByCategoryIds(
            @Param("categoryIds") List<Long> categoryIds
    );

}
