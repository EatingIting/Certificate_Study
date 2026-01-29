package com.example.demo.LMS채팅.controller;

import com.example.demo.LMS채팅.entity.ChatMessage;
import com.example.demo.LMS채팅.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatMessageRepository chatMessageRepository;

    /**
     * 📜 특정 채팅방의 지난 대화 기록 가져오기
     * GET /api/chat/rooms/{roomId}/messages
     */
    @GetMapping("/rooms/{roomId}/messages")
    public List<ChatMessage> getChatMessages(@PathVariable String roomId) {
        // DB에서 시간순으로 정렬해서 가져옴
        return chatMessageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
    }
}