package com.example.demo.attendance.mapper;

import lombok.Data;

@Data
public class AttendanceAllRow {
    private String memberId;
    private String name;
    private int sessionNo;
    private String joinAt;
    private String leaveAt;
}
