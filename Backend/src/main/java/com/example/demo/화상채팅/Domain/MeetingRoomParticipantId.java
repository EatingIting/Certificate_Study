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
public class MeetingRoomParticipantId implements Serializable {

    @Column(name = "room_id", length = 36)
    private String roomId;

    @Column(name = "user_email")
    private String userEmail;

    public MeetingRoomParticipantId(String roomId, String userEmail) {
        this.roomId = roomId;
        this.userEmail = userEmail;
    }
}
