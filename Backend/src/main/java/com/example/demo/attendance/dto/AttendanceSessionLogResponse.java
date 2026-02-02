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
    private String studyDate;   // YYYY-MM-DD
    private String startTime;   // 해당 회차 일정 시작 "HH:mm"
    private String endTime;     // 해당 회차 일정 종료 "HH:mm"
    private String joinAt;      // YYYY-MM-DDTHH:mm:ss (없으면 null)
    private String leaveAt;     // YYYY-MM-DDTHH:mm:ss (없으면 null)
}
