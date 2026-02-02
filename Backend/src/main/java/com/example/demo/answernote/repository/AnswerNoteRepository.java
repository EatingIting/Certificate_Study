package com.example.demo.answernote.repository;

import com.example.demo.answernote.entity.AnswerNote;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AnswerNoteRepository extends JpaRepository<AnswerNote, String> {
    // 특정 방(과목)의 오답노트 최신순 조회
    List<AnswerNote> findByRoom_RoomIdOrderByCreatedAtDesc(String roomId);
}