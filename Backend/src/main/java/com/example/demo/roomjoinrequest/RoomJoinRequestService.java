package com.example.demo.roomjoinrequest;

import java.util.List;

public interface RoomJoinRequestService {

    void apply(RoomJoinRequestVO vo);

    List<RoomJoinRequestVO> getSent(String userEmail);

    List<RoomJoinRequestVO> getReceived(String userEmail);

    void updateStatus(RoomJoinRequestVO vo);
}
