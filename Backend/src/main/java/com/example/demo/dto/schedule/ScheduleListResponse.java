package com.example.demo.dto.schedule;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleListResponse {
    private List<ScheduleEventResponse> items;
}