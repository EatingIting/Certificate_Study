package com.example.demo.화상채팅.DTO;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class RoomUser {
    private String userId;
    private String userName;
    private String userEmail;
    private boolean isHost;
    private long joinAt;
    private boolean speaking;
    private boolean muted;
    private boolean cameraOff;
    private boolean explicitlyLeft = false;

    @JsonProperty("online")
    private boolean online = true;  // 접속 상태 (새로고침 시 false로 설정됨)

    /** 얼굴 이모지 필터 (빈 문자열이면 미사용) */
    private String faceEmoji;
    /** 배경 제거 사용 여부 */
    private boolean bgRemove = false;

    /** 방장이 강제로 마이크를 끈 경우 — 해당 시 참가자는 스스로 마이크를 켤 수 없음 */
    @Getter(AccessLevel.NONE)
    private boolean mutedByHost = false;
    /** 방장이 강제로 카메라를 끈 경우 — 해당 시 참가자는 스스로 카메라를 켤 수 없음 */
    @Getter(AccessLevel.NONE)
    private boolean cameraOffByHost = false;

    public boolean getMutedByHost() {
        return mutedByHost;
    }

    public boolean getCameraOffByHost() {
        return cameraOffByHost;
    }
}
