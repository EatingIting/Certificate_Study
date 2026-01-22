package com.example.demo.domain;

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

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "participant_id")
    private Long participantId;

    @Column(name = "room_id", length = 36, nullable = false)
    private String roomId;

    @Column(name = "user_id", length = 36, nullable = false)
    private String userId;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    public MeetingRoomParticipant(String roomId, String userId) {
        this.roomId = roomId;
        this.userId = userId;
    }

    @PrePersist
    protected void onJoin() {
        this.joinedAt = LocalDateTime.now();
    }

    public void leave() {
        this.leftAt = LocalDateTime.now();
    }
}