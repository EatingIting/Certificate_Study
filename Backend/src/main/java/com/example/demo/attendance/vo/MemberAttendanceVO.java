package com.example.demo.attendance.vo;

import lombok.Data;
import java.util.List;

@Data
public class MemberAttendanceVO {
    private String memberId; // user_email
    private String name;     // 일단 email로 대체
    private List<AttendanceSessionVO> sessions;
}
