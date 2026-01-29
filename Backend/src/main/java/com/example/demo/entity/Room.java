package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "room")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Room {

    @Id
    @Column(name = "room_id", length = 36)
    private String roomId;

    @Column(name = "host_user_email", nullable = false)
    private String hostUserEmail;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "gender")
    private String gender; // ALL / FEMALE / MALE

    @Column(name = "max_participants")
    private Integer maxParticipants;

    @Column(name = "status")
    private String status; // OPEN / CLOSED

    @Column(name = "room_img")
    private String roomImg;

    @Column(name = "categoryId")
    private Long categoryId;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "exam_date")
    private LocalDate examDate;

    @Column(name = "deadline")
    private LocalDate deadline;

    @Column(name = "hostUserNickn")
    private String hostUserNickname;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "ended_at")
    private LocalDate endedAt;
}
