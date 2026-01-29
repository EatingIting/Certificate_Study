package com.example.demo.LMS채팅.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Long messageId;

    @Column(name = "room_id")
    private String roomId;

    @Column(name = "user_id")
    private String userId;

    // DB 컬럼명은 message, 자바 필드명은 messageText
    @Column(name = "message", columnDefinition = "TEXT")
    private String messageText;

    @CreationTimestamp // INSERT 시 시간 자동 저장
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}