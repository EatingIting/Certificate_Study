package com.example.demo.assignment.service;

import com.example.demo.assignment.dto.AssignmentCreateRequest;
import com.example.demo.assignment.dto.AssignmentListResponse;
import com.example.demo.assignment.dto.AssignmentSubmissionDetailResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AssignmentService {
    List<AssignmentListResponse> getAssignments(String roomId, String userEmail);

    Long createAssignment(String roomId, AssignmentCreateRequest req, String createdByEmail);

    List<AssignmentSubmissionDetailResponse> getSubmissionDetails(Long assignmentId);

    void submitAssignment(Long assignmentId, String userEmail, String submitTitle, String memo, MultipartFile file);
}




