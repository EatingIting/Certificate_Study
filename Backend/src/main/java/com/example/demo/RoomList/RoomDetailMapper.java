package com.example.demo.RoomList;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RoomDetailMapper {
    RoomDetailVO selectRoomDetail(String roomId);
}