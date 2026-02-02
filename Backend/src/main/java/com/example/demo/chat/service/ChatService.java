package com.example.demo.chat.service;

import com.example.demo.chat.entity.ChatMessage;
import com.example.demo.chat.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;

    // 1. 메시지 저장 (핸들러에서 호출할 예정)
    @Transactional
    public void saveMessage(String roomId, String userId, String userName, String message, String type) {
        ChatMessage chat = ChatMessage.builder()
                .roomId(roomId)
                .userId(userId)
                .userName(userName)     // 추가된 필드
                .messageText(message)   // 필드명 주의 (messageText)
                .messageType(type)      // 추가된 필드 (TALK or AI)
                .build();

        chatMessageRepository.save(chat);
    }

    // 2. 채팅 내역 조회 (컨트롤러에서 호출)
    @Transactional(readOnly = true)
    public List<ChatMessage> getChatHistory(String roomId) {
        return chatMessageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
    }
}