package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.ScheduleCreateRequest;
import com.example.demo.dto.schedule.ScheduleEventResponse;
import com.example.demo.dto.schedule.ScheduleUpdateRequest;
import com.example.demo.schedule.vo.ScheduleVO;

import java.sql.Date;
import java.util.List;

public interface ScheduleService {

    List<ScheduleVO> selectByRange(
            String roomId,
            Date start,
            Date endExclusive
    );

    /** type=EXAM 중 start_at >= 오늘인 가장 가까운 시험 1건 (없으면 null) */
    ScheduleVO selectNextExam(
            String roomId
    );

    Long insert(
            ScheduleCreateRequest req
    );

    void update(
            Long scheduleId,
            String roomId,
            ScheduleUpdateRequest req
    );

    void softDelete(
            Long scheduleId,
            String roomId
    );

    List<ScheduleEventResponse> getEvents(
            String roomId,
            String start,
            String end
    );
}