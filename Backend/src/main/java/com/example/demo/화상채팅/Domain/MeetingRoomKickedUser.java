package com.example.demo.화상채팅.Domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "meeting_room_kicked_user")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MeetingRoomKickedUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "room_id", nullable = false, length = 16)
    private String roomId;

    @Column(name = "user_email", nullable = false, length = 255)
    private String userEmail;

    @Column(name = "kicked_at", nullable = false)
    private LocalDateTime kickedAt;

    public MeetingRoomKickedUser(String roomId, String userEmail) {
        this.roomId = roomId;
        this.userEmail = userEmail;
        this.kickedAt = LocalDateTime.now();
    }
}
