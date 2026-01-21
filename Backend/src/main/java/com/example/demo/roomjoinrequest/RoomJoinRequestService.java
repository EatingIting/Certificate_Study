package com.example.demo.roomjoinrequest;

import java.util.List;

public interface RoomJoinRequestService {
    void apply(RoomJoinRequestVO vo);

    List<RoomJoinRequestVO> getSent(String userId);

    List<RoomJoinRequestVO> getReceived(String userId);

    void updateStatus(RoomJoinRequestVO vo);

}
