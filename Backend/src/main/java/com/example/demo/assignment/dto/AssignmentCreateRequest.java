package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentCreateRequest {
    private String title;
    private String description;
    private LocalDateTime dueAt;
    private String createdByEmail; // 지금은 임시로 받자(나중에 토큰에서 꺼냄)
}
