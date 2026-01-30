package com.example.demo.answernote.entity; // 👈 패키지 경로 수정됨

import com.example.demo.entity.Room; // 👈 기존 Room 엔티티 임포트
import com.example.demo.entity.User; // 👈 기존 User 엔티티 임포트
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "answer_note")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AnswerNote {

    @Id
    @Column(name = "answer_note_id", length = 36)
    private String answerNoteId; // UUID 직접 생성 방식

    // User 테이블 연결
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Room 테이블 연결
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "question", nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(name = "answer", nullable = false, columnDefinition = "TEXT")
    private String answer;

    @Column(name = "memo")
    private String memo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}