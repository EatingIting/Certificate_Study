package com.example.demo.assignment.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AssignmentCreateRequest {
    private String title;
    private String description;
    private LocalDateTime dueAt;

}
