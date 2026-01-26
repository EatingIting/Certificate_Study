package com.example.demo.RoomList;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class RoomDetailVO {

    private String roomId;
    private String title;
    private String content;

    private String gender;
    private int maxParticipants;

    private int currentParticipants;

    private String nickname;
    private String hostUserEmail;

    private String hostUserNickname;
    private Long categoryId;

    private String midCategoryName;
    private String subCategoryName;

    private LocalDate startDate;
    private LocalDate examDate;
    private LocalDate deadline;
    private LocalDate endDate;

    private LocalDateTime createdAt;
    private String roomImg;
}


