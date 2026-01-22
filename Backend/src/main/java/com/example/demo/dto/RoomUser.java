package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class RoomUser {
    private String userId;
    private String userName;
    private long joinAt;
    private boolean speaking;
    private boolean muted;
    private boolean cameraOff;
    private boolean explicitlyLeft = false;

    @JsonProperty("online")
    private boolean online = true;  // 접속 상태 (새로고침 시 false로 설정됨)
}