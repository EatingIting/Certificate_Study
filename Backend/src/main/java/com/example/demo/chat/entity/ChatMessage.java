package com.example.demo.chat.entity;

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

    // 🟢 [추가] 보낸 사람 이름 (화면 표시용)
    @Column(name = "user_name")
    private String userName;

    // DB 컬럼명은 message, 자바 필드명은 messageText
    @Column(name = "message", columnDefinition = "TEXT")
    private String messageText;

    // 🟢 [추가] 메시지 타입 (TALK: 일반, AI: 봇 답변)
    @Column(name = "message_type")
    private String messageType;

    @CreationTimestamp // INSERT 시 시간 자동 저장
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}