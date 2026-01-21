package com.example.demo.RoomList;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RoomListVO {
    private String roomId;
    private String title;
    private String nickname;
    private String midCategoryName;
    private String subCategoryName;
    private int maxParticipants;
    private String capacity;
    private LocalDateTime createdAt;
}