package com.example.demo.controller;

import com.example.demo.dto.schedule.ScheduleCreateRequest;
import com.example.demo.dto.schedule.ScheduleUpdateRequest;
import com.example.demo.service.schedule.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/schedules")
public class ScheduleController {

    private final ScheduleService scheduleService;

    // POST /api/schedules
    @PostMapping
    public Long create(@Valid @RequestBody ScheduleCreateRequest req) {
        return scheduleService.insert(req);
    }

    // PUT /api/schedules/{scheduleId}
    @PutMapping("/{scheduleId}")
    public void update(
            @PathVariable Long scheduleId,
            @Valid @RequestBody ScheduleUpdateRequest req
    ) {
        scheduleService.update(scheduleId, req);
    }

    // DELETE /api/schedules/{scheduleId}?roomId=...&userId=...
    // soft delete는 roomId/userId 체크를 mapper에서 하니까 여기서 같이 받음
    @DeleteMapping("/{scheduleId}")
    public void delete(
            @PathVariable Long scheduleId,
            @RequestParam String roomId,
            @RequestParam String userId
    ) {
        scheduleService.softDelete(scheduleId, roomId, userId);
    }
}