package com.example.demo.모집.mapper;

import com.example.demo.모집.vo.RoomCreateVO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface RoomCreateMapper {

    int insertRoom(RoomCreateVO room);

    int updateRoom(RoomCreateVO room);

    List<RoomCreateVO> findAllRooms();

    RoomCreateVO findRoomById(String roomId);
}