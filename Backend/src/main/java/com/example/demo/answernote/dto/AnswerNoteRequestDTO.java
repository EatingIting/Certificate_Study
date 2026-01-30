package com.example.demo.answernote.dto; // 👈 패키지 경로 수정됨

import lombok.Data;

@Data
public class AnswerNoteRequestDTO {
    private String subjectId; // 프론트에서는 roomId를 subjectId로 보냄
    private String question;
    private String answer;
    private String memo;
}