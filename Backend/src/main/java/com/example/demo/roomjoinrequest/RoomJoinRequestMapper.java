package com.example.demo.roomjoinrequest;

import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface RoomJoinRequestMapper {

    void insert(RoomJoinRequestVO vo);

    List<RoomJoinRequestVO> selectSent(String requestUserEmail);

    List<RoomJoinRequestVO> selectReceived(String ownerUserEmail);

    void updateStatus(RoomJoinRequestVO vo);
}
