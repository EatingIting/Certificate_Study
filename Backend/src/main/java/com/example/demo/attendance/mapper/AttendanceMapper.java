package com.example.demo.attendance.mapper;

import com.example.demo.attendance.vo.AttendanceScheduleTimeRow;
import com.example.demo.attendance.vo.AttendanceSessionVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AttendanceMapper {
    int countTotalSessions(@Param("studyRoomId") String studyRoomId);

    List<AttendanceSessionVO> selectMySessions(
            @Param("studyRoomId") String studyRoomId,
            @Param("userEmail") String userEmail
    );

    List<AttendanceAllRow> selectAllSessionsRaw(@Param("studyRoomId") String studyRoomId);
    AttendanceScheduleTimeRow selectScheduleTime(@Param("studyRoomId") String studyRoomId);

}
