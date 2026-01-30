package com.example.demo.attendance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceMemberLogResponse {
    private String memberId; // userEmail
    private String name;     // 닉네임(마스킹이름)
    private List<AttendanceSessionLogResponse> sessions;
}
