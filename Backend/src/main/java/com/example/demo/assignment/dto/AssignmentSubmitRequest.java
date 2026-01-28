package com.example.demo.assignment.dto;

import lombok.Data;

@Data
public class AssignmentSubmitRequest {
    private String userEmail;
    private String submitTitle;
    private String memo;
}
