package com.example.demo.RoomList;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class RoomListVO {
    private String roomId;
    private String title;
    private String nickname;

    private String midCategoryName;
    private String subCategoryName;

    private int maxParticipants;

    private int currentParticipants;

    private String gender;
    private LocalDateTime createdAt;

    private LocalDate deadline;
}
