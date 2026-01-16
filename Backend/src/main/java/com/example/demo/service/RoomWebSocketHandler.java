package com.example.demo.service;

import com.example.demo.dto.ChatInboundMessage;
import com.example.demo.dto.ChatOutboundMessage;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.catalina.User;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import com.example.demo.dto.RoomUser;

@Component
public class RoomWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, Map<String, WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    private final Map<String, Map<String, RoomUser>> roomUsers = new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    public RoomWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomId = extractRoomId(session);
        Map<String, String> params = getParams(session);

        String userId = params.get("userId");
        String userName = params.get("userName");
        boolean initialMuted = "true".equals(params.get("muted"));         // 문자열 "true"면 true, 아니면 false
        boolean initialCameraOff = "true".equals(params.get("cameraOff"));

        Map<String, RoomUser> users = roomUsers.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
        Map<String, WebSocketSession> sessions = roomSessions.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());

        String existingSessionId = null;
        for (Map.Entry<String, RoomUser> e : users.entrySet()) {
            if (e.getValue() != null && userId != null && userId.equals(e.getValue().getUserId())) {
                existingSessionId = e.getKey();
                break;
            }
        }

        if (existingSessionId != null) {
            WebSocketSession old = sessions.get(existingSessionId);
            if (old != null && old.isOpen()) {
                try { old.close(); } catch (Exception ignore) {}
            }
            sessions.remove(existingSessionId);
            users.remove(existingSessionId);
        }

        // 기존 로직
        sessions.put(session.getId(), session);
        users.put(session.getId(), new RoomUser(userId, userName, false, initialMuted, initialCameraOff));

        broadcast(roomId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = extractRoomId(session);

        Map<String, WebSocketSession> sessions = roomSessions.get(roomId);
        Map<String, RoomUser> users = roomUsers.get(roomId);

        if (sessions != null) sessions.remove(session.getId());
        if (users != null) users.remove(session.getId());

        broadcast(roomId);
    }

    private void broadcast(String roomId) {
        Map<String, WebSocketSession> sessions = roomSessions.get(roomId);
        Map<String, RoomUser> usersMap = roomUsers.get(roomId);

        if (sessions == null || usersMap == null) return;

        List<RoomUser> users = new ArrayList<>(usersMap.values());

        try {
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "USERS_UPDATE",
                            "users", users
                    )
            );

            TextMessage message = new TextMessage(payload);

            for (WebSocketSession session : sessions.values()) {
                if (session.isOpen()) {
                    session.sendMessage(message);
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private Map<String, String> getParams(WebSocketSession session) {
        Map<String, String> params = new HashMap<>();
        URI uri = session.getUri();

        if (uri == null || uri.getQuery() == null) return params;

        for (String pair : uri.getQuery().split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                params.put(
                        URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                        URLDecoder.decode(kv[1], StandardCharsets.UTF_8)
                );
            }
        }
        return params;
    }

    private String extractRoomId(WebSocketSession session) {
        String path = session.getUri().getPath();
        return path.substring(path.lastIndexOf("/") + 1);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {

        String roomId = extractRoomId(session);

        Map<String, RoomUser> users = roomUsers.get(roomId);
        Map<String, WebSocketSession> sessions = roomSessions.get(roomId);

        if (users == null || sessions == null) return;

        RoomUser sender = users.get(session.getId());
        if (sender == null) return;

        // JSON 파싱
        ChatInboundMessage inbound =
                objectMapper.readValue(message.getPayload(), ChatInboundMessage.class);

        String type = inbound.getType();
        if (type == null) return;

        //채팅메세지
        if ("CHAT".equalsIgnoreCase(type)) {

            String text = inbound.getMessage();
            if (text == null || text.trim().isEmpty()) return;

            text = text.trim();
            if (text.length() > 1000) {
                text = text.substring(0, 1000);
            }

            ChatOutboundMessage outbound = new ChatOutboundMessage(
                    "CHAT",
                    sender.getUserId(),
                    sender.getUserName(),
                    text,
                    System.currentTimeMillis()
            );

            String payload = objectMapper.writeValueAsString(outbound);
            TextMessage outboundMessage = new TextMessage(payload);

            // 같은 방 전체 브로드캐스트
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(outboundMessage);
                }
            }

            return;
        }

        // 말하기
        if ("SPEAKING".equalsIgnoreCase(type)) {

            Boolean speaking = inbound.getSpeaking();
            if (speaking == null) return;

            // 상태 갱신
            sender.setSpeaking(speaking);

            // USERS_UPDATE 재브로드캐스트
            List<RoomUser> userList = new ArrayList<>(users.values());

            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "USERS_UPDATE",
                            "users", userList
                    )
            );

            TextMessage updateMessage = new TextMessage(payload);

            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(updateMessage);
                }
            }
            return;
        }
        if ("USER_STATE_CHANGE".equalsIgnoreCase(type)) {
            Map<String, Object> changes = inbound.getChanges();

            if (changes != null) {
                if (changes.containsKey("muted")) {
                    sender.setMuted((Boolean) changes.get("muted"));
                }
                if (changes.containsKey("cameraOff")) {
                    sender.setCameraOff((Boolean) changes.get("cameraOff"));
                }
            }

            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "USER_STATE_CHANGE",
                            "userId", sender.getUserId(), // 보내는 사람 ID (String)
                            "changes", changes != null ? changes : new HashMap<>()
                    )
            );

            TextMessage broadcastMessage = new TextMessage(payload);

            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(broadcastMessage);
                }
            }
            return;
        }
    }
}
