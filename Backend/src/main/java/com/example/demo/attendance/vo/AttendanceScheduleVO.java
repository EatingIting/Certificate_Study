package com.example.demo.attendance.vo;

import lombok.Data;

@Data
public class AttendanceScheduleVO {
    private String start;         // "13:00"
    private String end;           // "15:00"
    private double requiredRatio; // 0.9
    private int totalSessions;     // 총 회차 수
}
