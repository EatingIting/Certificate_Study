package com.example.demo.attendance.vo;

import lombok.Data;

@Data
public class StudyScheduleVO {
    private String start;        // "13:00"
    private String end;          // "15:00"
    private Integer totalSessions;
}
