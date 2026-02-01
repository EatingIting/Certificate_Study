package com.example.demo.roomprofile;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RoomNicknameMapper {

    String selectMyNickname(
            @Param("roomId") String roomId,
            @Param("userEmail") String userEmail
    );

    int countNicknameDup(
            @Param("roomId") String roomId,
            @Param("nickname") String nickname,
            @Param("userEmail") String userEmail
    );

    int updateMyNickname(
            @Param("roomId") String roomId,
            @Param("userEmail") String userEmail,
            @Param("nickname") String nickname
    );
}
