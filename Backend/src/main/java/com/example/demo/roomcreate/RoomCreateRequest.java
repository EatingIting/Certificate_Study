package com.example.demo.roomcreate;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;

@Data
public class RoomCreateRequest {

    private String hostUserNickname;

    private String title;
    private String content;

    private String gender;
    private int maxParticipants;

    private Long categoryId;

    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate examDate;
    private LocalDate deadline;

    private MultipartFile image;
}
