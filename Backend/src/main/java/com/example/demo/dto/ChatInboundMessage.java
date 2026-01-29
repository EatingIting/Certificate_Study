package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatInboundMessage {
    private String type;
    private String message;
    private Boolean speaking;
    private String emoji;
    private Map<String, Object> changes;
    private String targetUserId;  // 방장 권한 기능용 (FORCE_MUTE, FORCE_CAMERA_OFF, KICK)
}
