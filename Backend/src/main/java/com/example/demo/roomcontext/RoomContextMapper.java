package com.example.demo.roomcontext;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RoomContextMapper {

    RoomBasicVO selectRoomBasic(@Param("roomId") String roomId);

    int countApprovedMember(@Param("roomId") String roomId,
                            @Param("email") String email);
}