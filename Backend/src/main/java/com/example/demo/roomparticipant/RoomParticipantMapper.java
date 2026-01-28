package com.example.demo.roomparticipant;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RoomParticipantMapper {

    String selectHostEmail(@Param("roomId") String roomId);

    // 승인된 참가자 목록 (users + room_join_request)
    List<RoomParticipantVO> selectApprovedParticipants(@Param("roomId") String roomId);

    // 이메일로 users 조회(호스트 정보 보장용)
    RoomParticipantVO selectUserByEmail(@Param("email") String email);

    // userId -> email
    String selectEmailByUserId(@Param("userId") String userId);

    // 승인 멤버인지 체크
    int countApprovedByEmail(@Param("roomId") String roomId, @Param("email") String email);

    // 강퇴/탈퇴: 승인행 삭제
    int deleteApprovedByEmail(@Param("roomId") String roomId, @Param("email") String email);

    // 방장 위임: room.host_user_email 변경
    int updateHostEmail(@Param("roomId") String roomId, @Param("newHostEmail") String newHostEmail);
}