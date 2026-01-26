package com.example.demo.assignment.service;

import com.example.demo.assignment.dto.AssignmentCreateRequest;
import com.example.demo.assignment.dto.AssignmentListResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AssignmentService {
    List<AssignmentListResponse> getAssignments(String roomId, String userId);
    Long createAssignment(String roomId, AssignmentCreateRequest req);
    void submitAssignment(Long assignmentId, String userId, String submitTitle, String memo, MultipartFile file);
}

