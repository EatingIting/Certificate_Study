package com.example.demo.화상채팅.Domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Embeddable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EqualsAndHashCode
public class MeetingRoomId implements Serializable {

    @Column(name = "room_id", length = 36)
    private String roomId;

    @Column(name = "host_user_email")
    private String hostUserEmail;

    public MeetingRoomId(String roomId, String hostUserEmail) {
        this.roomId = roomId;
        this.hostUserEmail = hostUserEmail;
    }
}
