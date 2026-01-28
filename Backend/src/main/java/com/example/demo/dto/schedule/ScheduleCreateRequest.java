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
public class ScheduleCreateRequest {

    @NotBlank
    private String roomId;

    @NotBlank
    private String userId;

    @NotBlank
    @Size(max = 200)
    private String title;

    private String description;

    // "YYYY-MM-DD"
    @NotBlank
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
    private String start;

    // "YYYY-MM-DD" (선택) - 프론트에서도 end는 선택임 :contentReference[oaicite:7]{index=7}
    @Pattern(regexp = "^$|^\\d{4}-\\d{2}-\\d{2}$")
    private String end;

    @NotBlank
    private String type; // REGISTRATION/EXAM/RESULT/OTHER

    @Pattern(regexp = "^#([A-Fa-f0-9]{6})$")
    private String colorHex;

    private String customLabel;

    // 프론트에 textColor가 있음 :contentReference[oaicite:8]{index=8} (DB엔 없으니 응답 전용으로 쓸지/DB에 추가할지 이후 결정)
    private String textColor;
}