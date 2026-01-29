package com.example.demo.화상채팅.Domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "meetingroom_participant")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MeetingRoomParticipant {

    @EmbeddedId
    private MeetingRoomParticipantId id;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    public MeetingRoomParticipant(String roomId, String userEmail) {
        this.id = new MeetingRoomParticipantId(roomId, userEmail);
    }

    public String getRoomId() {
        return id.getRoomId();
    }

    public String getUserEmail() {
        return id.getUserEmail();
    }

    @PrePersist
    protected void onJoin() {
        this.joinedAt = LocalDateTime.now();
    }

    public void leave() {
        this.leftAt = LocalDateTime.now();
    }

    public void rejoin() {
        this.leftAt = null;
    }
}
