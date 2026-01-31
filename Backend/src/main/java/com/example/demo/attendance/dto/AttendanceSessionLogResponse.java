package com.example.demo.attendance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceSessionLogResponse {
    private Integer sessionNo;   // round_num
    private String studyDate;    // YYYY-MM-DD
    private String startTime;   // HH:mm (해당 회차 수업 시작 시각, 비율 계산용)
    private String endTime;     // HH:mm (해당 회차 수업 종료 시각, 비율 계산용)
    private String joinAt;       // YYYY-MM-DDTHH:mm:ss (없으면 null)
    private String leaveAt;      // YYYY-MM-DDTHH:mm:ss (없으면 null)
}
