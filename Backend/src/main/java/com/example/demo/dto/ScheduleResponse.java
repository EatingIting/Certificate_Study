package com.example.demo.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
public class ScheduleResponse {

    private Long scheduleId;

    private String roomId; // char(36)
    private String userId; // char(36)

    private String title;
    private String description;

    private LocalDate startAt;
    private LocalDate endAt;

    private ScheduleType type;
    private String colorHex;
    private String customTypeLabel;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}