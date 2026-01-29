package com.example.demo.roomjoinrequest;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RoomJoinRequestMapper {

    void insert(RoomJoinRequestVO vo);

    String findStatus(@Param("requestUserEmail") String requestUserEmail,
                      @Param("roomId") String roomId);

    void reapply(RoomJoinRequestVO vo);

    List<RoomJoinRequestVO> selectSent(String requestUserEmail);

    List<RoomJoinRequestVO> selectReceived(String hostUserEmail);

    // 승인/거절 처리
    void updateStatus(RoomJoinRequestVO vo);
}
