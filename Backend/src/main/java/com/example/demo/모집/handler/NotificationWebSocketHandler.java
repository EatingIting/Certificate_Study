package com.example.demo.모집.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    // 방장 userId → WebSocketSession 저장
    private final Map<String, WebSocketSession> ownerSessions = new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    public NotificationWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // 방장 연결 시 세션 저장
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {

        String ownerId = extractUserId(session);

        ownerSessions.put(ownerId, session);

        System.out.println("방장 알림 WebSocket 연결됨: " + ownerId);
    }

    // 방장 연결 종료 시 제거
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {

        String ownerId = extractUserId(session);

        ownerSessions.remove(ownerId);

        System.out.println("❌ 방장 알림 WebSocket 종료됨: " + ownerId);
    }

    // 방장에게만 알림 보내는 함수
    public void sendToOwner(String ownerId, String content) {

        WebSocketSession session = ownerSessions.get(ownerId);

        // 방장이 접속 안 해있으면 종료
        if (session == null || !session.isOpen()) {
            System.out.println("⚠ 방장 접속 없음: " + ownerId);
            return;
        }

        try {
            // JSON 메시지 생성
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "NOTIFICATION",
                            "content", content,
                            "timestamp", System.currentTimeMillis()
                    )
            );

            session.sendMessage(new TextMessage(payload));

            System.out.println("🔔 방장 알림 전송 완료: " + ownerId);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // URL에서 userId 추출
    private String extractUserId(WebSocketSession session) {
        String path = session.getUri().getPath();
        return path.substring(path.lastIndexOf("/") + 1);
    }
}
