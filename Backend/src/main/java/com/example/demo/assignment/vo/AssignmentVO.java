package com.example.demo.assignment.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentVO {
    private Long assignmentId;
    private String roomId;
    private String title;
    private String description;
    private LocalDateTime dueAt;

    private String createdByEmail; // createdByUserId 제거/대체


    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
