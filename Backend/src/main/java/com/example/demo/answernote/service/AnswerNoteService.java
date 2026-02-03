package com.example.demo.answernote.service;

import com.example.demo.answernote.dto.AnswerNoteRequestDTO;
import com.example.demo.answernote.dto.AnswerNoteResponseDTO;
import com.example.demo.answernote.entity.AnswerNote;
import com.example.demo.answernote.entity.AnswerNoteType;
import com.example.demo.answernote.repository.AnswerNoteRepository;

import com.example.demo.LMS회원.Repository.RoomRepository;
import com.example.demo.LMS회원.Repository.UserRepository;

import com.example.demo.entity.Room;
import com.example.demo.entity.User;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AnswerNoteService {

    private final AnswerNoteRepository answerNoteRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;

    // 1. 저장 (이메일 조회 방식 유지)
    public void saveNote(String userEmail, AnswerNoteRequestDTO dto) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다. (Email: " + userEmail + ")"));

        Room room = roomRepository.findById(dto.getSubjectId())
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));

        AnswerNoteType noteType = AnswerNoteType.PROBLEM;
        if (dto.getType() != null && !dto.getType().isBlank()) {
            try {
                noteType = AnswerNoteType.valueOf(dto.getType().trim().toUpperCase());
            } catch (Exception ignored) {
                noteType = AnswerNoteType.PROBLEM;
            }
        }

        AnswerNote note = AnswerNote.builder()
                .answerNoteId(UUID.randomUUID().toString())
                .user(user)
                .room(room)
                .question(dto.getQuestion())
                .answer(dto.getAnswer())
                .memo(dto.getMemo())
                .noteType(noteType)
                .build();

        answerNoteRepository.save(note);
    }

    // 2. 조회
    @Transactional(readOnly = true)
    public List<AnswerNoteResponseDTO> getNotesByRoom(String roomId) {
        List<AnswerNote> notes = answerNoteRepository.findByRoom_RoomIdOrderByCreatedAtDesc(roomId);

        // 원본(Entity) 리스트를 -> 포장된(DTO) 리스트로 변환
        return notes.stream()
                .map(AnswerNoteResponseDTO::new)
                .collect(Collectors.toList());
    }
}