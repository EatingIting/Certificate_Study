package com.example.demo.answernote.controller;

import com.example.demo.answernote.dto.AnswerNoteRequestDTO;
import com.example.demo.answernote.dto.AnswerNoteResponseDTO;
import com.example.demo.answernote.service.AnswerNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/answernote")
@RequiredArgsConstructor
public class AnswerNoteController {

    private final AnswerNoteService answerNoteService;

    @PostMapping
    public ResponseEntity<String> createAnswerNote(
            @AuthenticationPrincipal String email,
            @RequestBody AnswerNoteRequestDTO dto) {

        answerNoteService.saveNote(email, dto);
        return ResponseEntity.ok("오답노트 저장 성공");
    }

    @GetMapping
    public ResponseEntity<List<AnswerNoteResponseDTO>> getAnswerNotes(@RequestParam String subjectId) {
        return ResponseEntity.ok(answerNoteService.getNotesByRoom(subjectId));
    }
}