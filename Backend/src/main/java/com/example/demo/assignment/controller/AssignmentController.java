package com.example.demo.assignment.controller;

import com.example.demo.assignment.dto.AssignmentCreateRequest;
import com.example.demo.assignment.dto.AssignmentListResponse;
import com.example.demo.assignment.service.AssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

    // 1) 과제 목록
    @GetMapping("/rooms/{roomId}/assignments")
    public ResponseEntity<List<AssignmentListResponse>> getAssignments(
            @PathVariable String roomId,
            @RequestParam String userId
    ) {
        return ResponseEntity.ok(assignmentService.getAssignments(roomId, userId));
    }

    // 2) 과제 생성
    @PostMapping("/rooms/{roomId}/assignments")
    public ResponseEntity<Map<String, Object>> createAssignment(
            @PathVariable String roomId,
            @RequestBody AssignmentCreateRequest req
    ) {
        Long id = assignmentService.createAssignment(roomId, req);
        return ResponseEntity.ok(Map.of("assignmentId", id));
    }

    // 3) 과제 제출 (multipart)
    @PostMapping("/assignments/{assignmentId}/submissions")
    public ResponseEntity<?> submitAssignment(
            @PathVariable Long assignmentId,
            @RequestParam String userId,
            @RequestParam String submitTitle,
            @RequestParam(required = false) String memo,
            @RequestPart(required = false) MultipartFile file
    ) {
        assignmentService.submitAssignment(assignmentId, userId, submitTitle, memo, file);
        return ResponseEntity.ok().build();
    }

    //과제 상세(로그인 붙으면 이걸로)
//    @GetMapping("/assignments/{assignmentId}/submissions")
//    public ResponseEntity<List<
//            AssignmentSubmissionDetailResponse>> getSubmissionDetails(
//            @PathVariable Long assignmentId
//    ) {
//        return ResponseEntity.ok(assignmentService.getSubmissionDetails(assignmentId));
//    }

    @GetMapping("/assignments/{assignmentId}/submissions")
    public ResponseEntity<List<AssignmentSubmissionDetailResponse>> getSubmissionDetails(
            @PathVariable Long assignmentId,
            @RequestParam(required = false) String userId // ✅ 임시
    ) {
        return ResponseEntity.ok(
                assignmentService.getSubmissionDetails(assignmentId)
        );
    }


}
