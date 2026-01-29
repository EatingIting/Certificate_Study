package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentSubmissionDetailResponse {
    private String userId;

    // 예: "가나디(홍*동)"
    private String memberName;

    private LocalDateTime submittedAt; // 미제출이면 null
    private String status;             // "제출됨" / "미제출"

    private String fileUrl;            // 없으면 null
    private String fileName;           // 없으면 null
}
