package com.example.demo.assignment.service;

import com.example.demo.assignment.dto.AssignmentCreateRequest;
import com.example.demo.assignment.dto.AssignmentListResponse;
import com.example.demo.assignment.dto.AssignmentSubmissionDetailResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AssignmentService {
    List<AssignmentListResponse> getAssignments(String roomId, String userId);
    Long createAssignment(String roomId, AssignmentCreateRequest req);
    List<AssignmentSubmissionDetailResponse> getSubmissionDetails(Long assignmentId);

    void submitAssignment(Long assignmentId, String userId, String submitTitle, String memo, MultipartFile file);
}

