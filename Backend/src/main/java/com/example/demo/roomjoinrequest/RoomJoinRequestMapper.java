package com.example.demo.roomjoinrequest;

import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface RoomJoinRequestMapper {

    // 신청
    void insert(RoomJoinRequestVO vo);

    // 내가 신청한 목록
    List<RoomJoinRequestVO> selectSent(String requestUserId);

    // 내가 받은 신청
    List<RoomJoinRequestVO> selectReceived(String ownerUserId);

    // 상태 변경
    void updateStatus(RoomJoinRequestVO vo);
}