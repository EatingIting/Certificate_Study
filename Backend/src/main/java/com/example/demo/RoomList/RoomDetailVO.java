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
    private int maxPeople;

    private String nickname;
    private String midCategoryName;
    private String subCategoryName;

    private LocalDate startDate;
    private LocalDate examDate;
    private LocalDate deadline;
    private LocalDateTime endDate;

    private LocalDateTime createdAt;
}
