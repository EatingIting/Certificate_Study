package com.example.demo.chat.handler;

import com.example.demo.chat.dto.ChatMessageDTO;
import com.example.demo.chat.service.ChatService; // 🟢 [1] 서비스 임포트
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    // private final ChatMessageRepository chatMessageRepository; // ❌ 기존 레포지토리 제거
    private final ChatService chatService; // 🟢 [2] 서비스 주입으로 변경

    // 메모리 내에 접속자 관리 (Key: RoomId, Value: Session Set)
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    // 1. 소켓 연결 시 (입장)
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomId = getRoomId(session);

        // 해당 방에 세션 추가
        roomSessions.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("✅ 입장: RoomId={}, SessionId={}", roomId, session.getId());

        // 입장 시 최신 접속자 명단 전송
        broadcastUserList(roomId);
    }

    // 2. 메시지 전송 시
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        ChatMessageDTO chatMessageDTO = objectMapper.readValue(payload, ChatMessageDTO.class);
        String roomId = getRoomId(session);

        String userId = chatMessageDTO.getUserId();

        // 유효성 검사
        if (userId == null || userId.length() < 30) {
            log.warn("⚠️ 유효하지 않은 UserID({})로 인해 DB 저장을 건너뜁니다.", userId);
            broadcastToRoom(roomId, chatMessageDTO);
            return;
        }

        // 🟢 [3] ChatService를 통해 DB 저장 (이름, 타입 포함)
        try {
            // 메시지 타입이 없으면 기본값 TALK
            String msgType = (chatMessageDTO.getType() != null) ? chatMessageDTO.getType() : "TALK";

            chatService.saveMessage(
                    roomId,
                    userId,
                    chatMessageDTO.getUserName(), // DTO에서 유저 이름 가져오기
                    chatMessageDTO.getMessage(),  // 메시지 내용
                    msgType                       // 메시지 타입 (TALK or AI)
            );

            // (참고: createdAt은 DB에 들어가면서 자동 생성되므로,
            // 실시간 전송 시에는 현재 시간을 넣어주거나 프론트에서 처리해도 무방합니다)
            chatMessageDTO.setCreatedAt(java.time.LocalDateTime.now().toString());

        } catch (Exception e) {
            log.error("DB 저장 실패 (채팅은 계속 진행됩니다): {}", e.getMessage());
        }

        broadcastToRoom(roomId, chatMessageDTO);
    }

    // 3. 소켓 종료 시 (퇴장)
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String roomId = getRoomId(session);
        Set<WebSocketSession> sessions = roomSessions.get(roomId);

        if (sessions != null) {
            sessions.remove(session);
        }
        log.info("❌ 퇴장: RoomId={}, SessionId={}", roomId, session.getId());

        // 퇴장 후 갱신된 명단 전송
        broadcastUserList(roomId);
    }

    // ---  유틸리티 메서드 (기존 동일) ---

    // 방 전체 메시지 전송
    private void broadcastToRoom(String roomId, ChatMessageDTO messageDTO) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            try {
                String jsonMessage = objectMapper.writeValueAsString(messageDTO);
                TextMessage textMessage = new TextMessage(jsonMessage);
                for (WebSocketSession s : sessions) {
                    if (s.isOpen()) s.sendMessage(textMessage);
                }
            } catch (Exception e) {
                log.error("메시지 전송 실패", e);
            }
        }
    }

    // 접속자 명단 전송
    private void broadcastUserList(String roomId) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

        List<Map<String, String>> userList = new ArrayList<>();
        for (WebSocketSession s : sessions) {
            Map<String, String> params = parseQuery(s.getUri().getQuery());
            Map<String, String> userInfo = new HashMap<>();
            userInfo.put("userId", params.getOrDefault("userId", "unknown"));
            userInfo.put("userName", params.getOrDefault("userName", "알수없음"));
            userList.add(userInfo);
        }

        Map<String, Object> data = new HashMap<>();
        data.put("type", "USERS_UPDATE");
        data.put("users", userList);

        try {
            String jsonStr = objectMapper.writeValueAsString(data);
            TextMessage message = new TextMessage(jsonStr);
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) s.sendMessage(message);
            }
        } catch (Exception e) {
            log.error("접속자 목록 전송 실패", e);
        }
    }

    // URL 쿼리 파싱
    private Map<String, String> parseQuery(String query) {
        Map<String, String> queryPairs = new HashMap<>();
        if (query == null) return queryPairs;
        for (String pair : query.split("&")) {
            int idx = pair.indexOf("=");
            if (idx > 0) {
                queryPairs.put(
                        URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8),
                        URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8)
                );
            }
        }
        return queryPairs;
    }

    // URL에서 RoomId 추출
    private String getRoomId(WebSocketSession session) {
        String path = session.getUri().getPath();
        String[] segments = path.split("/");
        return segments[segments.length - 1];
    }
}