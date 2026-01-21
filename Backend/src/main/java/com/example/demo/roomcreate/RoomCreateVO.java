package com.example.demo.roomcreate;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RoomCreateVO {
    private String roomId;
    private String hostUserId;
    private String title;
    private String content;
    private String capacity;        // 성별 제한
    private int maxParticipants;
    private String status;
    private Long categoryId; ;
    private LocalDateTime createdAt;
}