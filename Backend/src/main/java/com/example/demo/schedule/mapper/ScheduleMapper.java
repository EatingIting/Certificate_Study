package com.example.demo.schedule.mapper;

import com.example.demo.schedule.vo.ScheduleVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.sql.Date;
import java.util.List;

@Mapper
public interface ScheduleMapper {

    // 범위 조회(겹치는 일정 포함) + deleted_at IS NULL
    List<ScheduleVO> selectByRange(
            @Param("roomId") String roomId,
            @Param("start") Date start,
            @Param("endExclusive") Date endExclusive
    );

    int insert(ScheduleVO schedule);

    int update(ScheduleVO schedule);

    // soft delete (작성자만 삭제 가능하게 roomId/userId 같이 체크)
    int softDelete(
            @Param("scheduleId") Long scheduleId,
            @Param("roomId") String roomId,
            @Param("userId") String userId
    );

    /** type=EXAM, start_at >= 오늘, 가장 가까운 시험 1건 */
    ScheduleVO selectNextExam(@Param("roomId") String roomId);
}