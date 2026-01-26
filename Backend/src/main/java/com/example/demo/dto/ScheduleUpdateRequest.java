package com.example.demo.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@NoArgsConstructor
public class ScheduleUpdateRequest {

    @Size(max = 200)
    private String title;

    private String description;

    private LocalDate startAt;
    private LocalDate endAt;

    private ScheduleType type;

    @Size(max = 7)
    private String colorHex;

    @Size(max = 60)
    private String customTypeLabel;
}
