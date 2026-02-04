package com.example.demo.answernote.dto;

import lombok.Data;

@Data
public class AnswerNoteRequestDTO {
    private String subjectId;
    private String question;
    private String answer;
    private String memo;
    /** SUMMARY | PROBLEM (없으면 PROBLEM로 저장) */
    private String type;
}