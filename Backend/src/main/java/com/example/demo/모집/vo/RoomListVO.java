package com.example.demo.모집.vo;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class RoomListVO {
    private String roomId;
    private String title;
    private String hostUserNickname;

    private String hostUserEmail;

    private String midCategoryName;
    private String subCategoryName;

    private int maxParticipants;

    private int currentParticipants;

    private String gender;
    private LocalDateTime createdAt;

    private LocalDate deadline;
    private LocalDate startDate;
    private String roomImg;
}
