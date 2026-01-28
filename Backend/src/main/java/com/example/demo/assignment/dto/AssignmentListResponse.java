package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentListResponse {
    private Long assignmentId;
    private String title;
    private LocalDateTime dueAt;
    private String authorEmail; // 작성자 email
    private String status;      // "제출 완료" / "제출 하기"
}
