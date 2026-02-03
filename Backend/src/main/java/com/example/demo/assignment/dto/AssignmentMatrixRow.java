package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentMatrixRow {
    private String userId;
    private String memberName;
    private Long assignmentId;

    private Long submissionId;
    private LocalDateTime submittedAt;  // ✅ 여기!
    private String fileUrl;
}
