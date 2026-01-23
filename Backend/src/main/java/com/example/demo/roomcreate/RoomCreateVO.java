package com.example.demo.roomcreate;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class RoomCreateVO {

    private String roomId;

    private String hostUserEmail;
    private String hostUserNickname;

    private String title;
    private String content;

    private String gender;
    private int maxParticipants;

    private String status;

    private Long categoryId;

    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate examDate;
    private LocalDate deadline;

    private LocalDateTime createdAt;
}
