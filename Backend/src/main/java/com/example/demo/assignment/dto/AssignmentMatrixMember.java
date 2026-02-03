package com.example.demo.assignment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class AssignmentMatrixMember {
    private String userId;    // email
    private String name;      // "닉네임(이름마스킹)" 또는 "방장(이름마스킹)"
    private List<AssignmentMatrixCell> submissions; // assignmentId별 제출 여부
}
