package com.example.demo.schedule.controller;

import com.example.demo.dto.schedule.ScheduleEventResponse;
import com.example.demo.dto.schedule.ScheduleListResponse;
import com.example.demo.schedule.service.ScheduleQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

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

    /** 다가오는 시험 1건 (type=EXAM, start_at >= 오늘, 없으면 null) - 대시보드 D-day용 */
    @GetMapping("/exam/next")
    public Map<String, Object> getNextExam(@PathVariable String roomId) {
        ScheduleEventResponse item = scheduleQueryService.getNextExam(roomId);
        Map<String, Object> body = new HashMap<>();
        body.put("item", item);
        return body;
    }
}