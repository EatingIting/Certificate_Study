package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentListResponse {
    private Long assignmentId;
    private String title;
    private LocalDateTime dueAt;
    private String authorEmail; // 작성자 email
    private String authorName;  // 작성자 표시용 이름(방별 닉네임 우선)
    private String status;      // "제출 완료" / "제출 하기"
}
