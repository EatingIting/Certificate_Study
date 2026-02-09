package com.example.demo.모집.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    // userId -> sessions (멀티 탭/멀티 화면 동시 수신)
    private final Map<String, Set<WebSocketSession>> ownerSessions =
            new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    public NotificationWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String ownerId = extractUserId(session);
        ownerSessions
                .computeIfAbsent(ownerId, key -> ConcurrentHashMap.newKeySet())
                .add(session);
        System.out.println("✅ 알림 WebSocket 연결됨: " + ownerId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String ownerId = extractUserId(session);
        Set<WebSocketSession> sessions = ownerSessions.get(ownerId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                ownerSessions.remove(ownerId);
            }
        }
        System.out.println("❌ 알림 WebSocket 종료됨: " + ownerId);
    }

    public void sendToOwner(String ownerId, String content) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "NOTIFICATION");
        payload.put("notificationType", "APPLICATION");
        payload.put("content", content);
        sendPayload(ownerId, payload, "모집 신청");
    }

    public void sendToOwner(
            String ownerId,
            Long postId,
            String postTitle,
            String commentPreview
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "NOTIFICATION");
        payload.put("notificationType", "COMMENT");
        payload.put("postId", postId);
        payload.put("postTitle", postTitle);
        payload.put("content", commentPreview);
        sendPayload(ownerId, payload, "댓글");
    }

    public void sendCommentNotification(
            String userId,
            String roomId,
            Long postId,
            String postTitle,
            String commentPreview
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "NOTIFICATION");
        payload.put("notificationType", "COMMENT");
        payload.put("roomId", roomId);
        payload.put("postId", postId);
        payload.put("postTitle", postTitle);
        payload.put("content", commentPreview);
        sendPayload(userId, payload, "댓글");
    }

    public void sendApplicationDecisionNotification(
            String userId,
            String status,
            String content
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "NOTIFICATION");
        payload.put("notificationType", "APPLICATION");
        payload.put("status", status);
        payload.put("content", content);
        sendPayload(userId, payload, "가입신청 상태");
    }

    public void sendLmsNotification(
            String userId,
            String notificationType,
            String roomId,
            Long assignmentId,
            Long scheduleId,
            String title,
            String content
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "NOTIFICATION");
        payload.put("notificationType", notificationType);
        payload.put("roomId", roomId);
        payload.put("title", title);
        payload.put("content", content);
        if (assignmentId != null) payload.put("assignmentId", assignmentId);
        if (scheduleId != null) payload.put("scheduleId", scheduleId);
        sendPayload(userId, payload, "LMS");
    }

    private void sendPayload(
            String userId,
            Map<String, Object> payload,
            String logType
    ) {
        Set<WebSocketSession> sessions = ownerSessions.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            System.out.println("❌ 접속 없음(" + logType + "): " + userId);
            return;
        }

        try {
            String message = objectMapper.writeValueAsString(payload);
            boolean sent = false;

            for (WebSocketSession session : sessions) {
                if (session == null) continue;
                synchronized (session) {
                    if (!session.isOpen()) continue;
                    session.sendMessage(new TextMessage(message));
                    sent = true;
                }
            }

            if (!sent) {
                System.out.println("❌ 세션 닫힘(" + logType + "): " + userId);
                ownerSessions.remove(userId);
                return;
            }

            System.out.println("📢 " + logType + " 알림 전송 완료 → " + userId);
        } catch (Exception e) {
            ownerSessions.remove(userId);
            e.printStackTrace();
        }
    }

    private String extractUserId(WebSocketSession session) {
        if (session.getUri() == null || session.getUri().getPath() == null) {
            return "";
        }
        String path = session.getUri().getPath();
        return path.substring(path.lastIndexOf("/") + 1);
    }
}
