package com.example.demo.attendance.controller;

import com.example.demo.attendance.dto.AttendanceSummaryResponse;
import com.example.demo.attendance.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class AttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping("/subjects/{subjectId}/attendance")
    public ResponseEntity<AttendanceSummaryResponse> getAttendance(
            @PathVariable String subjectId,
            @RequestParam(defaultValue = "my") String scope, // my | all
            Authentication authentication
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        String userEmail = authentication.getName();
        return ResponseEntity.ok(attendanceService.getAttendance(subjectId, userEmail, scope));
    }
}
