package com.example.demo.assignment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class AssignmentMatrixCell {
    private Long assignmentId;
    private boolean isSubmitted;
    private LocalDateTime submittedAt;

    private String fileUrl;
}
