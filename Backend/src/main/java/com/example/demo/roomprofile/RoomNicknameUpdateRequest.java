package com.example.demo.roomprofile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RoomNicknameUpdateRequest {

    @NotBlank(message = "nickname은 필수입니다.")
    @Size(min = 2, max = 12, message = "nickname은 2~12자여야 합니다.")
    private String nickname;
}