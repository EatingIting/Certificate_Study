package com.example.demo.application;

import java.time.LocalDateTime;

import lombok.Data;

@Data
public class ApplicationVO {

    // room_join_request
    private String joinId;
    private String requestUserId;
    private String ownerUserId;
    private String roomId;
    private String status;
    private String applyMessage;
    private LocalDateTime requestedAt;

    // room
    private String studyTitle;

    // users
    private String applicantNickname;
    private String ownerNickname;
    private String gender;
    private Integer age;
}

