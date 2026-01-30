package com.example.demo.attendance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudyScheduleResponse {
    private String start;        // "13:00"
    private String end;          // "15:00"
    private Double requiredRatio; // 0.9
    private Integer totalSessions; // 6
}
