package com.example.demo.schedule.controller;

import com.example.demo.dto.schedule.ScheduleListResponse;
import com.example.demo.schedule.service.ScheduleQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms/{roomId}/schedule")
public class ScheduleQueryController {

    private final ScheduleQueryService scheduleQueryService;

    // GET /api/rooms/{roomId}/schedule?start=2026-01-01&end=2026-02-01
    // end는 exclusive(미포함)로 받는다고 가정
    @GetMapping
    public ScheduleListResponse getCalendarEvents(
            @PathVariable String roomId,
            @RequestParam String start,
            @RequestParam String end
    ) {
        return scheduleQueryService.getCalendarEvents(roomId, start, end);
    }
}