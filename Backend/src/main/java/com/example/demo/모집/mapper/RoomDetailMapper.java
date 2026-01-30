package com.example.demo.모집.mapper;

import com.example.demo.모집.vo.RoomDetailVO;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RoomDetailMapper {
    RoomDetailVO selectRoomDetail(String roomId);
}