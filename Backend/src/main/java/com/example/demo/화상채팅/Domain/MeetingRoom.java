package com.example.demo.화상채팅.Domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "meeting_room")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MeetingRoom {

    @EmbeddedId
    private MeetingRoomId id;

    @Column(name = "subject_id", nullable = false, length = 36)
    private String subjectId;

    @Column(name = "schedule_id", nullable = true)
    private Long scheduleId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    public MeetingRoom(String roomId, String hostUserEmail, String subjectId, Long scheduleId) {
        this.id = new MeetingRoomId(roomId, hostUserEmail);
        this.subjectId = subjectId;
        this.scheduleId = scheduleId;
    }

    public String getRoomId() {
        return id.getRoomId();
    }

    public String getHostUserEmail() {
        return id.getHostUserEmail();
    }

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public void endMeeting() {
        this.endedAt = LocalDateTime.now();
    }

    public void rejoin() {
        this.endedAt = null;
    }
}
