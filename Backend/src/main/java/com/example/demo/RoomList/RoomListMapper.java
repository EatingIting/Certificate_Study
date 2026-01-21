package com.example.demo.RoomList;

import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface RoomListMapper {
    List<RoomListVO> selectRoomList();
}