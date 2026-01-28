package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentCreateRequest {
    private String title;
    private String description;
    private LocalDateTime dueAt;
    private String createdByEmail;

    // 임시: 나중에 토큰에서 꺼내면 이 필드 자체를 제거 가능
    private String createdByUserId;
}
