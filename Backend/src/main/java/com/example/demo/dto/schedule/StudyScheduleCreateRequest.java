package com.example.demo.dto.schedule;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudyScheduleCreateRequest {

    @NotBlank
    private String roomId;

    @NotNull
    @Min(1)
    private Integer round;

    @NotBlank
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
    private String date;

    @Size(max = 500)
    private String description;
}