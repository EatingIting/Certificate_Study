package com.example.demo.roomjoinrequest;

import lombok.Data;

@Data
public class RoomJoinRequestVO {

    private String joinId;
    private String requestUserId;
    private String ownerUserId;
    private String roomId;
    private String status;       // 신청중 / 승인 / 거절
    private String applyMessage;
    private String requestedAt;

    // 조회용
    private String studyTitle;
    private String nickname;


}
