package com.example.demo.attendance.controller;

import com.example.demo.attendance.dto.AttendanceResponseVO;
import com.example.demo.attendance.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms/{roomId}/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    /**
     * ✅ Assignment와 같은 패턴
     * GET /api/rooms/{roomId}/attendance?scope=my|all
     *
     * - scope=my  : 로그인 유저의 출석
     * - scope=all : 전체 출석
     */
    @GetMapping
    public ResponseEntity<AttendanceResponseVO> attendance(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "my") String scope,
            Authentication authentication
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        String userEmail = authentication.getName();

        if ("all".equalsIgnoreCase(scope)) {
            return ResponseEntity.ok(attendanceService.getAllAttendance(roomId));
        }

        // 기본: my
        return ResponseEntity.ok(attendanceService.getMyAttendance(roomId, userEmail));
    }
}
