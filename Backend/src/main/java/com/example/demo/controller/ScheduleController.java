package com.example.demo.controller;

import com.example.demo.dto.ScheduleCreateRequest;
import com.example.demo.dto.ScheduleResponse;
import com.example.demo.dto.ScheduleUpdateRequest;
import com.example.demo.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("api/schedules")
public class ScheduleController {

    private final ScheduleService scheduleService;

    // 일정 생성
    @PostMapping("/api/rooms/{roomId}/schedules")
    public ResponseEntity<ScheduleResponse> createSchedule(
            @PathVariable String roomId,
            @Valid @RequestBody ScheduleCreateRequest request
    ) {
        ScheduleResponse created = scheduleService.createSchedule(roomId, request);
        return ResponseEntity.ok(created);
    }

    // 일정 목록 조회
    @GetMapping("/rooms/{roomId}/schedules")
    public ResponseEntity<List<ScheduleResponse>> getSchedules(
            @PathVariable String roomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(scheduleService.getSchedules(roomId, from, to));
    }

    // 일정 수정
    @PutMapping("/{scheduleId}")
    public ResponseEntity<ScheduleResponse> updateSchedule(
            @PathVariable Long scheduleId,
            @RequestBody ScheduleUpdateRequest request
    ) {
        ScheduleResponse updated = scheduleService.updateSchedule(scheduleId, request);
        return ResponseEntity.ok(updated);
    }

    // 일정 삭제rmfj
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable Long scheduleId) {
        scheduleService.deleteSchedule(scheduleId);
        return ResponseEntity.noContent().build();
    }
}
