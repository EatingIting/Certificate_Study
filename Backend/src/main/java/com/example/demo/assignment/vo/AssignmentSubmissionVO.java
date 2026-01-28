package com.example.demo.assignment.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentSubmissionVO {
    private Long submissionId;
    private Long assignmentId;
    private String userId;

    private String submitTitle;
    private String memo;
    private LocalDateTime submittedAt;

    private String fileName;
    private String fileUrl;
    private Long fileSize;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
