package com.example.demo.chat.repository;

import com.example.demo.chat.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    // 특정 방의 지난 대화 내용을 시간순으로 가져오기
    List<ChatMessage> findByRoomIdOrderByCreatedAtAsc(String roomId);
}