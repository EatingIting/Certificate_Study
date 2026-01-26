package com.example.demo.service;

import com.example.demo.dto.ScheduleCreateRequest;
import com.example.demo.dto.ScheduleResponse;
import com.example.demo.dto.ScheduleUpdateRequest;

import java.time.LocalDate;
import java.util.List;

public interface ScheduleService {

    // 일정 생성
    ScheduleResponse createSchedule(String roomId, ScheduleCreateRequest request);

    // 일정 목록 조회
    List<ScheduleResponse> getSchedules(String roomId, LocalDate from, LocalDate to);

    // 일정 수정
    ScheduleResponse updateSchedule(Long scheduleId, ScheduleUpdateRequest request);

    // 일정 삭제
    void deleteSchedule(Long scheduleId);
}
