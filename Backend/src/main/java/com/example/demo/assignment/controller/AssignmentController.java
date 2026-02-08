package com.example.demo.assignment.controller;

import com.example.demo.assignment.dto.AssignmentCreateRequest;
import com.example.demo.assignment.dto.AssignmentListResponse;
import com.example.demo.assignment.dto.AssignmentMatrixResponse;
import com.example.demo.assignment.service.AssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.demo.assignment.dto.AssignmentSubmissionDetailResponse;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class AssignmentController {



    private final AssignmentService assignmentService;


    // 1) 과제 목록 (userId 파라미터 제거)
    @GetMapping("/rooms/{roomId}/assignments")
    public ResponseEntity<List<AssignmentListResponse>> getAssignments(
            @PathVariable String roomId,
            Authentication authentication
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        String userEmail = authentication.getName();
        return ResponseEntity.ok(assignmentService.getAssignments(roomId, userEmail));
    }


    // 2) 과제 생성 (작성자 userId는 authentication.getName())
    @PostMapping("/rooms/{roomId}/assignments")
    public ResponseEntity<Map<String, Object>> createAssignment(
            @PathVariable String roomId,
            @RequestBody AssignmentCreateRequest req,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        Long id = assignmentService.createAssignment(roomId, req, userEmail);
        return ResponseEntity.ok(Map.of("assignmentId", id));
    }

    // 3) 과제 제출 (제출자 userId는 authentication.getName())
    @PostMapping("/assignments/{assignmentId}/submissions")
    public ResponseEntity<?> submitAssignment(
            @PathVariable Long assignmentId,
            @RequestParam String submitTitle,
            @RequestParam(required = false) String memo,
            @RequestPart(required = false) MultipartFile file,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        assignmentService.submitAssignment(assignmentId, userEmail, submitTitle, memo, file);
        return ResponseEntity.ok().build();
    }

    // 4) 과제 제출 현황 (여긴 userId 필요 없으면 그대로)
    @GetMapping("/assignments/{assignmentId}/submissions")
    public ResponseEntity<List<AssignmentSubmissionDetailResponse>> getSubmissionDetails(
            @PathVariable Long assignmentId
    ) {
        return ResponseEntity.ok(assignmentService.getSubmissionDetails(assignmentId));
    }

    @GetMapping("/rooms/{roomId}/assignments/submission-matrix")
    public ResponseEntity<AssignmentMatrixResponse> getSubmissionMatrix(
            @PathVariable String roomId
    ) {
        return ResponseEntity.ok(assignmentService.getSubmissionMatrix(roomId));
    }

    @DeleteMapping("/assignments/{assignmentId}")
    public ResponseEntity<?> deleteAssignment(
            @PathVariable Long assignmentId,
            Authentication authentication
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        String userEmail = authentication.getName();
        assignmentService.deleteAssignment(assignmentId, userEmail);
        return ResponseEntity.ok(Map.of("message", "deleted"));
    }
}
