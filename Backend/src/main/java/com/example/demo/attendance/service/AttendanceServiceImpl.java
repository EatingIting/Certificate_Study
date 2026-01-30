package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.AttendanceResponseVO;
import com.example.demo.attendance.mapper.AttendanceAllRow;
import com.example.demo.attendance.mapper.AttendanceMapper;
import com.example.demo.attendance.vo.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceMapper attendanceMapper;
    private static final double REQUIRED_RATIO = 0.9;

    private AttendanceScheduleVO buildSchedule(String studyRoomId) {
        int totalSessions = attendanceMapper.countTotalSessions(studyRoomId);

        AttendanceScheduleTimeRow timeRow = attendanceMapper.selectScheduleTime(studyRoomId);

        AttendanceScheduleVO s = new AttendanceScheduleVO();
        s.setRequiredRatio(REQUIRED_RATIO);
        s.setTotalSessions(totalSessions);

        // ✅ 일정이 없을 때(0건)도 프론트가 죽지 않게 기본값 처리
        if (timeRow == null || timeRow.getStart() == null || timeRow.getEnd() == null) {
            s.setStart("00:00");
            s.setEnd("00:00");
            return s;
        }

        s.setStart(timeRow.getStart());
        s.setEnd(timeRow.getEnd());
        return s;
    }


    @Override
    public AttendanceResponseVO getMyAttendance(String studyRoomId, String userEmail) {
        AttendanceScheduleVO schedule = buildSchedule(studyRoomId);
        List<AttendanceSessionVO> sessions = attendanceMapper.selectMySessions(studyRoomId, userEmail);

        MemberAttendanceVO me = new MemberAttendanceVO();
        me.setMemberId(userEmail);
        me.setName(userEmail);
        me.setSessions(sessions);

        AttendanceResponseVO res = new AttendanceResponseVO();
        res.setStudySchedule(schedule);
        res.setAttendanceLogs(List.of(me));
        return res;
    }

    @Override
    public AttendanceResponseVO getAllAttendance(String studyRoomId) {
        AttendanceScheduleVO schedule = buildSchedule(studyRoomId);
        List<AttendanceAllRow> rows = attendanceMapper.selectAllSessionsRaw(studyRoomId);

        Map<String, MemberAttendanceVO> grouped = new LinkedHashMap<>();

        for (AttendanceAllRow r : rows) {
            MemberAttendanceVO m = grouped.computeIfAbsent(r.getMemberId(), k -> {
                MemberAttendanceVO vo = new MemberAttendanceVO();
                vo.setMemberId(r.getMemberId());
                vo.setName(r.getName());
                vo.setSessions(new ArrayList<>());
                return vo;
            });

            AttendanceSessionVO s = new AttendanceSessionVO();
            s.setSessionNo(r.getSessionNo());
            s.setJoinAt(r.getJoinAt());
            s.setLeaveAt(r.getLeaveAt());
            m.getSessions().add(s);
        }

        AttendanceResponseVO res = new AttendanceResponseVO();
        res.setStudySchedule(schedule);
        res.setAttendanceLogs(new ArrayList<>(grouped.values()));
        return res;
    }
}
