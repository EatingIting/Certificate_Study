package com.example.demo.service.schedule;

import com.example.demo.dto.schedule.ScheduleListResponse;

public interface ScheduleQueryService {
    ScheduleListResponse getCalendarEvents(String roomId, String start, String end);
}