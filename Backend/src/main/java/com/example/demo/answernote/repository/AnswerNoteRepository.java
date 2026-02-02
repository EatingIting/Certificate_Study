package com.example.demo.answernote.repository; // 👈 패키지 경로 수정됨!

import com.example.demo.answernote.entity.AnswerNote; // 👈 로컬 엔티티 임포트
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AnswerNoteRepository extends JpaRepository<AnswerNote, String> {
    // 특정 방(과목)의 오답노트 최신순 조회
    List<AnswerNote> findByRoom_RoomIdOrderByCreatedAtDesc(String roomId);
}