package com.example.demo.dto.schedule;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleUpdateRequest {

    @NotBlank
    @Size(max = 200)
    private String title;

    private String description;

    @NotBlank
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
    private String start;

    @Pattern(regexp = "^$|^\\d{4}-\\d{2}-\\d{2}$")
    private String end;

    @NotBlank
    private String type;

    @Pattern(regexp = "^#([A-Fa-f0-9]{6})$")
    private String colorHex;

    private String customLabel;
    private String textColor;
}