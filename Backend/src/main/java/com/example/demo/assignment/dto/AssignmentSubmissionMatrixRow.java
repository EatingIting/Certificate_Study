package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentSubmissionMatrixRow {

    // 사용자
    private String userId;        // u.email
    private String name;          // 가공된 이름(방장(홍*동))

    // 과제
    private Long assignmentId;

    // 제출 여부
    private Boolean isSubmitted;
    private LocalDateTime submittedAt;
}
