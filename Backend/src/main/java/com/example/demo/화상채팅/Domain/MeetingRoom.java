package com.example.demo.화상채팅.Domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "MeetingRoom")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MeetingRoom {

    @EmbeddedId
    private MeetingRoomId id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    public MeetingRoom(String roomId, String hostUserEmail, String title) {
        this.id = new MeetingRoomId(roomId, hostUserEmail);
        this.title = title;
    }

    public String getRoomId() {
        return id.getRoomId();
    }

    public String getHostUserEmail() {
        return id.getHostUserEmail();
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void endMeeting() {
        this.endedAt = LocalDateTime.now();
    }

    public void rejoin() {
        this.endedAt = null;
    }
}
