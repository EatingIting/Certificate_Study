package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.AttendanceResponseVO;

public interface AttendanceService {
    AttendanceResponseVO getMyAttendance(String studyRoomId, String userEmail);
    AttendanceResponseVO getAllAttendance(String studyRoomId);
}
