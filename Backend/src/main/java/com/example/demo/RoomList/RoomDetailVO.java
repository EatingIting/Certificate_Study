package com.example.demo.RoomList;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RoomDetailVO {
    private String roomId;
    private String title;
    private String description;   
    private String gender;
    private int maxPeople;
    private String nickname;
    private String midCategoryName;
    private String subCategoryName;
    private LocalDateTime createdAt;
}