package com.example.demo.schedule.controller;

import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.schedule.service.StudyScheduleService;
import com.example.demo.schedule.vo.StudyScheduleVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Date;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/study-schedules")
public class StudyScheduleController {

    private final StudyScheduleService studyScheduleService;

    @GetMapping
    public List<StudyScheduleVO> getStudySchedules(
            @RequestParam String roomId,
            @RequestParam String start,
            @RequestParam String end
    ) {
        Date startDate = Date.valueOf(start);
        Date endDate = Date.valueOf(end);

        return studyScheduleService.selectByRange(roomId, startDate, endDate);
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody StudyScheduleCreateRequest req) {
        try {
            Long id = studyScheduleService.insert(req);
            return ResponseEntity.ok(id);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    @PutMapping("/{studyScheduleId}")
    public void update(
            @PathVariable Long studyScheduleId,
            @RequestParam String roomId,
            @Valid @RequestBody StudyScheduleUpdateRequest req
    ) {
        studyScheduleService.update(studyScheduleId, roomId, req);
    }

    @DeleteMapping("/{studyScheduleId}")
    public void delete(
            @PathVariable Long studyScheduleId,
            @RequestParam String roomId
    ) {
        studyScheduleService.delete(studyScheduleId, roomId);
    }

    /** 스터디 일정 추가 시 제안할 다음 회차 번호 (중복 방지용) */
    @GetMapping("/next-round")
    public int getNextRound(@RequestParam String roomId) {
        return studyScheduleService.getNextRoundNum(roomId);
    }
}