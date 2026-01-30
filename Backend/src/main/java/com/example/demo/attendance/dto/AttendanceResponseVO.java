package com.example.demo.attendance.dto;

import com.example.demo.attendance.vo.AttendanceScheduleVO;
import com.example.demo.attendance.vo.MemberAttendanceVO;
import lombok.Data;
import java.util.List;

@Data
public class AttendanceResponseVO {
    private AttendanceScheduleVO studySchedule;
    private List<MemberAttendanceVO> attendanceLogs;
}
