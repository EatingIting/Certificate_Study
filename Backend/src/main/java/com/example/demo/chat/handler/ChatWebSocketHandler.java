package com.example.demo.chat.handler;

import com.example.demo.chat.dto.ChatMessageDTO;
import com.example.demo.chat.entity.ChatMessage;
import com.example.demo.chat.repository.ChatMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final ChatMessageRepository chatMessageRepository;

    // 1️⃣ Map의 키를 Long -> String으로 변경 (방 번호가 문자열이므로)
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomId = getRoomId(session); // 👈 String으로 받음

        // 2️⃣ String 키 사용
        roomSessions.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("입장: RoomId={}, SessionId={}", roomId, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        ChatMessageDTO chatMessageDTO = objectMapper.readValue(payload, ChatMessageDTO.class);

        String roomId = getRoomId(session); // 👈 String으로 받음

        // 3️⃣ DB 저장 시 String roomId 사용
        ChatMessage chatMessage = ChatMessage.builder()
                .roomId(roomId)
                .userId(chatMessageDTO.getUserId())
                .messageText(chatMessageDTO.getMessage())
                .build();
        chatMessageRepository.save(chatMessage);

        // 4️⃣ Map 조회도 String 키 사용
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    s.sendMessage(new TextMessage(objectMapper.writeValueAsString(chatMessageDTO)));
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String roomId = getRoomId(session); // 👈 String으로 받음
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            sessions.remove(session);
        }
        log.info("퇴장: RoomId={}, SessionId={}", roomId, session.getId());
    }

    // 5️⃣ Long.parseLong() 제거! 그냥 문자열 그대로 반환
    private String getRoomId(WebSocketSession session) {
        String path = session.getUri().getPath();
        String[] segments = path.split("/");
        return segments[segments.length - 1]; // "bebbffd2-..." 같은 문자열 그대로 리턴
    }
}