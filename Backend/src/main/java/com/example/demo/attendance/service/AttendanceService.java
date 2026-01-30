package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.AttendanceSummaryResponse;

public interface AttendanceService {
    AttendanceSummaryResponse getAttendance(String subjectId, String userEmail, String scope);
}
