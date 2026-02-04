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

    // userId → session 저장
    private final Map<String, WebSocketSession> ownerSessions =
            new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    public NotificationWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {

        String ownerId = extractUserId(session);
        ownerSessions.put(ownerId, session);

        System.out.println("✅ 알림 WebSocket 연결됨: " + ownerId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {

        String ownerId = extractUserId(session);
        ownerSessions.remove(ownerId);

        System.out.println("❌ 알림 WebSocket 종료됨: " + ownerId);
    }

    public void sendToOwner(String ownerId, String content) {

        WebSocketSession session = ownerSessions.get(ownerId);

        if (session == null || !session.isOpen()) {
            System.out.println("⚠ 접속 없음: " + ownerId);
            return;
        }

        try {
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "NOTIFICATION",
                            "content", content
                    )
            );

            session.sendMessage(new TextMessage(payload));

            System.out.println("🔔 모집 신청 알림 전송 완료 → " + ownerId);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void sendToOwner(
            String ownerId,
            Long postId,
            String postTitle,
            String commentPreview
    ) {

        WebSocketSession session = ownerSessions.get(ownerId);

        if (session == null || !session.isOpen()) {
            System.out.println("⚠ 접속 없음: " + ownerId);
            return;
        }

        try {
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "NOTIFICATION",
                            "postId", postId,
                            "postTitle", postTitle,
                            "content", commentPreview
                    )
            );

            session.sendMessage(new TextMessage(payload));

            System.out.println("🔔 댓글 알림 전송 완료 → " + ownerId);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String extractUserId(WebSocketSession session) {
        String path = session.getUri().getPath();
        return path.substring(path.lastIndexOf("/") + 1);
    }
}
