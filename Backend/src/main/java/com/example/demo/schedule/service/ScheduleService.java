package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.ScheduleCreateRequest;
import com.example.demo.dto.schedule.ScheduleUpdateRequest;
import com.example.demo.schedule.vo.ScheduleVO;

import java.sql.Date;
import java.util.List;

public interface ScheduleService {

    List<ScheduleVO> selectByRange(String roomId, Date start, Date endExclusive);

    Long insert(ScheduleCreateRequest req);

    void update(Long scheduleId, String roomId, String userId, ScheduleUpdateRequest req);

    void softDelete(Long scheduleId, String roomId, String userId);
}