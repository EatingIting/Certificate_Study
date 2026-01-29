package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.ScheduleListResponse;

public interface ScheduleQueryService {
    ScheduleListResponse getCalendarEvents(String roomId, String start, String end);
}