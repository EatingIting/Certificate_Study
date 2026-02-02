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

    /** 시작 시간 (HH:mm 또는 HH:mm:ss), 선택 */
    @Pattern(regexp = "^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$")
    private String startTime;

    /** 종료 시간 (HH:mm 또는 HH:mm:ss), 선택 */
    @Pattern(regexp = "^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$")
    private String endTime;

    @Size(max = 500)
    private String description;
}