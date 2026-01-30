package com.example.demo.모집.vo;

import lombok.Data;

@Data
public class RoomJoinRequestVO {

    private String joinId;
    private String requestUserEmail;
    private String hostUserEmail;
    private String roomId;
    private String status;
    private String applyMessage;
    private String requestedAt;

    private String studyTitle;
    private String nickname;
}
