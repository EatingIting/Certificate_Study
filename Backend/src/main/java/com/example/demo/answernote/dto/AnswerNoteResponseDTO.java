package com.example.demo.answernote.dto;

import com.example.demo.answernote.entity.AnswerNote;
import lombok.Getter;
import java.time.LocalDateTime;

@Getter
public class AnswerNoteResponseDTO {
    private String id;
    private String question;
    private String answer;
    private String memo;
    private LocalDateTime createdAt;
    private String type;
    /** 작성자 표시용 (LMS 닉네임) */
    private String authorName;
    /** 작성자 이메일 (본인 노트 여부 판단용) */
    private String userEmail;

    // 엔티티(원본)를 받아서 DTO(박스)로 옮겨담는 기본 생성자
    public AnswerNoteResponseDTO(AnswerNote note) {
        this.id = note.getAnswerNoteId();
        this.question = note.getQuestion();
        this.answer = note.getAnswer();
        this.memo = note.getMemo();
        this.createdAt = note.getCreatedAt();
        this.type = note.getNoteType() != null ? note.getNoteType().name() : null;
        this.userEmail = note.getUser() != null ? note.getUser().getEmail() : null;
    }

    // authorName 을 서비스에서 주입할 수 있는 보조 생성자
    public AnswerNoteResponseDTO(AnswerNote note, String authorName) {
        this(note);
        this.authorName = authorName;
    }
}