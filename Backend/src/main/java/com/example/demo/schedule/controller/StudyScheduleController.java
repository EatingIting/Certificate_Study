package com.example.demo.schedule.controller;

import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.schedule.service.StudyScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/study-schedules")
public class StudyScheduleController {

    private final StudyScheduleService studyScheduleService;

    // POST /api/study-schedules
    @PostMapping
    public Long create(@Valid @RequestBody StudyScheduleCreateRequest req) {
        return studyScheduleService.insert(req);
    }

    // PUT /api/study-schedules/{studyScheduleId}
    @PutMapping("/{studyScheduleId}")
    public void update(
            @PathVariable Long studyScheduleId,
            @RequestParam String roomId,
            @Valid @RequestBody StudyScheduleUpdateRequest req
    ) {
        studyScheduleService.update(studyScheduleId, roomId, req);
    }

    // DELETE /api/study-schedules/{studyScheduleId}?roomId=...
    @DeleteMapping("/{studyScheduleId}")
    public void delete(
            @PathVariable Long studyScheduleId,
            @RequestParam String roomId
    ) {
        studyScheduleService.delete(studyScheduleId, roomId);
    }
}