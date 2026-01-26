package com.example.demo.dto.schedule;

import lombok.*;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleEventResponse {

    private String id;      // schedules: "123", study: "S45"
    private String title;

    private String start;   // "YYYY-MM-DD"
    private String end;     // "YYYY-MM-DD" (exclusive) - 없으면 null

    private Map<String, Object> extendedProps;

    private String backgroundColor;
    private String borderColor;
    private String textColor;
}