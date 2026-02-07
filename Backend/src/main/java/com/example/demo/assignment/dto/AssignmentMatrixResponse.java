package com.example.demo.assignment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class AssignmentMatrixResponse {
    private List<AssignmentMatrixAssignment> assignments; // 열(과제들)
    private List<AssignmentMatrixMember> members;         // 행(멤버들)
}
