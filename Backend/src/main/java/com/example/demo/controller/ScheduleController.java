package com.example.demo.controller;

import com.example.demo.dto.schedule.ScheduleCreateRequest;
import com.example.demo.dto.schedule.ScheduleUpdateRequest;
import com.example.demo.LMS회원.Service.LmsAccessService;
import com.example.demo.service.schedule.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/schedules")
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final LmsAccessService lmsAccessService;

    // POST /api/schedules
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ScheduleCreateRequest req, Authentication authentication) {
        String userEmail = authentication.getName();
        
        // 방장만 일정 추가 가능
        if (!lmsAccessService.isHost(userEmail, req.getRoomId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "일정 추가는 방장만 가능합니다."));
        }
        
        Long scheduleId = scheduleService.insert(req);
        return ResponseEntity.ok(scheduleId);
    }

    // PUT /api/schedules/{scheduleId}?roomId=...
    @PutMapping("/{scheduleId}")
    public ResponseEntity<?> update(
            @PathVariable Long scheduleId,
            @RequestParam String roomId,
            @Valid @RequestBody ScheduleUpdateRequest req,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        
        // 방장만 일정 수정 가능
        if (!lmsAccessService.isHost(userEmail, roomId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "일정 수정은 방장만 가능합니다."));
        }
        
        scheduleService.update(scheduleId, req);
        return ResponseEntity.ok().build();
    }

    // DELETE /api/schedules/{scheduleId}?roomId=...&userId=...
    // soft delete는 roomId/userId 체크를 mapper에서 하니까 여기서 같이 받음
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<?> delete(
            @PathVariable Long scheduleId,
            @RequestParam String roomId,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        
        // 방장만 일정 삭제 가능
        if (!lmsAccessService.isHost(userEmail, roomId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "일정 삭제는 방장만 가능합니다."));
        }
        
        scheduleService.softDelete(scheduleId, roomId, userEmail);
        return ResponseEntity.ok().build();
    }
}