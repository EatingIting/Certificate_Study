package com.example.demo.모집.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    private static final int MAX_PENDING_PER_USER = 500;

    // userId -> sessions (멀티 탭/멀티 화면 동시 수신)
    private final Map<String, Set<WebSocketSession>> ownerSessions =
            new ConcurrentHashMap<>();
    // userId -> (notificationId -> message JSON)
    private final Map<String, LinkedHashMap<String, String>> pendingMessagesByUser =
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

        flushPendingMessages(ownerId, session);
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

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String ownerId = extractUserId(session);
        if (ownerId.isBlank()) return;

        try {
            JsonNode node = objectMapper.readTree(message.getPayload());
            String type = node.path("type").asText("");
            if (!"ACK".equalsIgnoreCase(type)) return;

            String notificationId = node.path("notificationId").asText("").trim();
            if (notificationId.isBlank()) return;

            acknowledgePending(ownerId, notificationId);
        } catch (Exception e) {
            // ACK 메시지가 아닌 경우는 무시
        }
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
        if (userId == null || userId.isBlank()) {
            return;
        }

        try {
            String notificationId = asText(payload.get("notificationId"));
            if (notificationId.isBlank()) {
                notificationId = UUID.randomUUID().toString();
                payload.put("notificationId", notificationId);
            }

            String message = objectMapper.writeValueAsString(payload);
            enqueuePendingMessage(userId, notificationId, message);

            boolean sent = sendToActiveSessions(userId, message);
            if (!sent) {
                System.out.println("❌ 접속 없음(" + logType + "): " + userId);
                return;
            }

            System.out.println("📢 " + logType + " 알림 전송 완료 → " + userId);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private boolean sendToActiveSessions(String userId, String message) {
        Set<WebSocketSession> sessions = ownerSessions.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return false;
        }

        boolean sent = false;
        for (WebSocketSession session : sessions) {
            if (session == null) continue;
            synchronized (session) {
                if (!session.isOpen()) continue;
                try {
                    session.sendMessage(new TextMessage(message));
                    sent = true;
                } catch (Exception e) {
                    // 개별 세션 전송 실패는 다른 세션 전송을 막지 않음
                }
            }
        }

        if (!sent) {
            ownerSessions.remove(userId);
            return false;
        }
        return true;
    }

    private void flushPendingMessages(String userId, WebSocketSession session) {
        if (session == null || !session.isOpen()) return;

        List<String> pendingMessages = readPendingSnapshot(userId);
        if (pendingMessages.isEmpty()) return;

        synchronized (session) {
            if (!session.isOpen()) return;
            for (String pendingMessage : pendingMessages) {
                try {
                    session.sendMessage(new TextMessage(pendingMessage));
                } catch (Exception e) {
                    break;
                }
            }
        }
    }

    private List<String> readPendingSnapshot(String userId) {
        LinkedHashMap<String, String> pending = pendingMessagesByUser.get(userId);
        if (pending == null) return List.of();

        synchronized (pending) {
            if (pending.isEmpty()) return List.of();
            return new ArrayList<>(pending.values());
        }
    }

    private void enqueuePendingMessage(String userId, String notificationId, String message) {
        LinkedHashMap<String, String> pending =
                pendingMessagesByUser.computeIfAbsent(userId, key -> new LinkedHashMap<>());

        synchronized (pending) {
            pending.put(notificationId, message);
            while (pending.size() > MAX_PENDING_PER_USER) {
                String firstKey = pending.keySet().iterator().next();
                pending.remove(firstKey);
            }
        }
    }

    private void acknowledgePending(String userId, String notificationId) {
        LinkedHashMap<String, String> pending = pendingMessagesByUser.get(userId);
        if (pending == null) return;

        synchronized (pending) {
            pending.remove(notificationId);
            if (pending.isEmpty()) {
                pendingMessagesByUser.remove(userId, pending);
            }
        }
    }

    private String asText(Object value) {
        if (value == null) return "";
        return String.valueOf(value).trim();
    }

    private String extractUserId(WebSocketSession session) {
        if (session.getUri() == null || session.getUri().getPath() == null) {
            return "";
        }
        String path = session.getUri().getPath();
        return path.substring(path.lastIndexOf("/") + 1);
    }
}
