package com.example.demo.chat.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.demo.chat.dto.ChatMessageDTO;
import com.example.demo.chat.entity.ChatMessage;
import com.example.demo.chat.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final ChatMessageRepository chatMessageRepository;

    // 채팅방(roomId)별로 접속한 사람들의 세션을 관리하는 저장소
    private final Map<Long, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    // 1. 소켓 연결 성공 시
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long roomId = getRoomId(session);
        // 방에 세션 추가
        roomSessions.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("입장: RoomId={}, SessionId={}", roomId, session.getId());
    }

    // 2. 메시지 전송 시 (여기가 핵심!)
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        // JSON -> DTO 변환
        ChatMessageDTO chatMessageDTO = objectMapper.readValue(payload, ChatMessageDTO.class);
        Long roomId = getRoomId(session);

        // ✅ DB에 저장 (Entity로 변환 후 저장)
        ChatMessage chatMessage = ChatMessage.builder()
                .roomId(roomId)
                .userId(chatMessageDTO.getUserId())
                .messageText(chatMessageDTO.getMessage())
                .build();
        chatMessageRepository.save(chatMessage); // 저장 완료!

        // ✅ 같은 방 사람들에게 메시지 전송
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    // DTO를 다시 JSON 문자열로 바꿔서 전송
                    s.sendMessage(new TextMessage(objectMapper.writeValueAsString(chatMessageDTO)));
                }
            }
        }
    }

    // 3. 소켓 연결 종료 시
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Long roomId = getRoomId(session);
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            sessions.remove(session);
        }
        log.info("퇴장: RoomId={}, SessionId={}", roomId, session.getId());
    }

    // URL에서 roomId 추출 (/ws/room/1 -> 1)
    private Long getRoomId(WebSocketSession session) {
        String path = session.getUri().getPath();
        String[] segments = path.split("/");
        return Long.parseLong(segments[segments.length - 1]);
    }
}