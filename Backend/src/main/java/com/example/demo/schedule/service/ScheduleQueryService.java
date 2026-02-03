package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.ScheduleEventResponse;
import com.example.demo.dto.schedule.ScheduleListResponse;

public interface ScheduleQueryService {
    ScheduleListResponse getCalendarEvents(String roomId, String start, String end);

    /** 다가오는 시험 1건 (type=EXAM, start_at >= 오늘, 없으면 null) */
    ScheduleEventResponse getNextExam(String roomId);
}