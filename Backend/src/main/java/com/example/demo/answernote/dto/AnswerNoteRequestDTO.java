package com.example.demo.answernote.dto;

import lombok.Data;

@Data
public class AnswerNoteRequestDTO {
    private String subjectId;
    private String question;
    private String answer;
    private String memo;
}