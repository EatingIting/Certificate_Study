package com.example.demo.화상채팅.Domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "meetingroom_participant",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = { "schedule_id", "room_id", "user_email" })
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MeetingRoomParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "participant_id")
    private Long participantId;

    @Column(name = "subject_id", nullable = false, length = 36)
    private String subjectId;

    @Column(name = "schedule_id", nullable = true)
    private Long scheduleId;

    @Column(name = "room_id", nullable = false, length = 16)
    private String roomId;

    @Column(name = "user_email", nullable = false, length = 255)
    private String userEmail;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    public MeetingRoomParticipant(String subjectId, Long scheduleId, String roomId, String userEmail) {
        this.subjectId = subjectId;
        this.scheduleId = scheduleId;
        this.roomId = roomId;
        this.userEmail = userEmail;
    }

    @PrePersist
    protected void onJoin() {
        if (this.joinedAt == null) {
            this.joinedAt = LocalDateTime.now();
        }
    }

    public void leave() {
        this.leftAt = LocalDateTime.now();
    }

    public void rejoin() {
        this.leftAt = null;
    }

    /** 회차 전환 시 이전 회차 종료 시각으로 left_at 설정용 */
    public void setLeftAt(java.time.LocalDateTime leftAt) {
        this.leftAt = leftAt;
    }

    /** 캐치업 시 다음 회차 시작 시각으로 joined_at 설정용 */
    public void setJoinedAt(java.time.LocalDateTime joinedAt) {
        this.joinedAt = joinedAt;
    }
}
