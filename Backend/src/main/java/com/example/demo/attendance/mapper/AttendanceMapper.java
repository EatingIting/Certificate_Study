package com.example.demo.attendance.mapper;

import com.example.demo.attendance.dto.AttendanceMemberLogResponse;
import com.example.demo.attendance.dto.AttendanceSessionLogResponse;
import com.example.demo.attendance.vo.StudyScheduleVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AttendanceMapper {

    StudyScheduleVO selectStudySchedule(@Param("subjectId") String subjectId);

    List<AttendanceMemberLogResponse> selectAttendanceLogsAll(@Param("subjectId") String subjectId);

    List<AttendanceMemberLogResponse> selectAttendanceLogsMy(
            @Param("subjectId") String subjectId,
            @Param("userEmail") String userEmail
    );
}
