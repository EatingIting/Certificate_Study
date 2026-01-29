package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "room_join_request")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class RoomJoinRequest {

    @Id
    @Column(name = "join_id", length = 36)
    private String joinId;

    @Column(name = "request_user_email", nullable = false)
    private String requestUserEmail;

    @Column(name = "host_user_email", nullable = false)
    private String hostUserEmail;

    @Column(name = "room_id", nullable = false, length = 36)
    private String roomId;

    @Column(name = "status", nullable = false)
    private String status; // 신청중 / 승인 / 거절

    @Column(name = "apply_message", columnDefinition = "TEXT")
    private String applyMessage;

    @Column(name = "request_user_nickname")
    private String requestUserNickname;

    @CreationTimestamp
    @Column(name = "requested_at", updatable = false)
    private LocalDateTime requestedAt;

    // JPA 관계 설정 (선택사항)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", insertable = false, updatable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_user_email", referencedColumnName = "email", insertable = false, updatable = false)
    private User requestUser;
}
