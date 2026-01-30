package com.example.demo.attendance.vo;

import lombok.Data;

@Data
public class AttendanceSessionVO {
    private int sessionNo;   // round_num
    private String joinAt;   // ISO string
    private String leaveAt;  // ISO string
}
