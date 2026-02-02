package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.AttendanceSummaryResponse;
import com.example.demo.attendance.dto.StudyScheduleResponse;
import com.example.demo.attendance.mapper.AttendanceMapper;
import com.example.demo.attendance.vo.StudyScheduleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceMapper attendanceMapper;

    // ✅ 지금 테이블에 없으니 일단 상수로 (나중에 subject 설정 테이블 생기면 거기서 조회)
    private static final double REQUIRED_RATIO = 0.9;

    @Override
    public AttendanceSummaryResponse getAttendance(String subjectId, String userEmail, String scope) {

        StudyScheduleVO scheduleVO = attendanceMapper.selectStudySchedule(subjectId);

        StudyScheduleResponse schedule = StudyScheduleResponse.builder()
                .start(scheduleVO != null ? scheduleVO.getStart() : null)
                .end(scheduleVO != null ? scheduleVO.getEnd() : null)
                .requiredRatio(REQUIRED_RATIO)
                .totalSessions(scheduleVO != null ? scheduleVO.getTotalSessions() : 0)
                .build();

        boolean isAll = "all".equalsIgnoreCase(scope);

        return AttendanceSummaryResponse.builder()
                .studySchedule(schedule)
                .attendanceLogs(
                        isAll
                                ? attendanceMapper.selectAttendanceLogsAll(subjectId)
                                : attendanceMapper.selectAttendanceLogsMy(subjectId, userEmail)
                )
                .build();
    }
}
