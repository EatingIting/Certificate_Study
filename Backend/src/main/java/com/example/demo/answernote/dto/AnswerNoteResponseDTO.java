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

    // 엔티티(원본)를 받아서 DTO(박스)로 옮겨담는 생성자
    public AnswerNoteResponseDTO(AnswerNote note) {
        this.id = note.getAnswerNoteId();
        this.question = note.getQuestion();
        this.answer = note.getAnswer();
        this.memo = note.getMemo();
        this.createdAt = note.getCreatedAt();
        this.type = note.getNoteType() != null ? note.getNoteType().name() : null;
    }
}