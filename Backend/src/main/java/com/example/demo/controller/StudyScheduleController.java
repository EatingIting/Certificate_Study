package com.example.demo.controller;

import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.LMS회원.Service.LmsAccessService;
import com.example.demo.service.schedule.StudyScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/study-schedules")
public class StudyScheduleController {

    private final StudyScheduleService studyScheduleService;
    private final LmsAccessService lmsAccessService;

    // POST /api/study-schedules
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody StudyScheduleCreateRequest req, Authentication authentication) {
        String userEmail = authentication.getName();
        
        // 방장만 스터디 일정 추가 가능
        if (!lmsAccessService.isHost(userEmail, req.getRoomId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "스터디 일정 추가는 방장만 가능합니다."));
        }
        
        Long scheduleId = studyScheduleService.insert(req);
        return ResponseEntity.ok(scheduleId);
    }

    // PUT /api/study-schedules/{studyScheduleId}?roomId=...
    @PutMapping("/{studyScheduleId}")
    public ResponseEntity<?> update(
            @PathVariable Long studyScheduleId,
            @RequestParam String roomId,
            @Valid @RequestBody StudyScheduleUpdateRequest req,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        
        // 방장만 스터디 일정 수정 가능
        if (!lmsAccessService.isHost(userEmail, roomId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "스터디 일정 수정은 방장만 가능합니다."));
        }
        
        studyScheduleService.update(studyScheduleId, req);
        return ResponseEntity.ok().build();
    }

    // DELETE /api/study-schedules/{studyScheduleId}?roomId=...
    @DeleteMapping("/{studyScheduleId}")
    public ResponseEntity<?> delete(
            @PathVariable Long studyScheduleId,
            @RequestParam String roomId,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        
        // 방장만 스터디 일정 삭제 가능
        if (!lmsAccessService.isHost(userEmail, roomId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "스터디 일정 삭제는 방장만 가능합니다."));
        }
        
        studyScheduleService.delete(studyScheduleId, roomId);
        return ResponseEntity.ok().build();
    }
}