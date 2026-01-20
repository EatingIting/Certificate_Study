package com.example.demo.service;

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

        roomSessions
                .computeIfAbsent(roomId, k -> new ConcurrentHashMap<>())
                .put(session.getId(), session);

        roomUsers
                .computeIfAbsent(roomId, k -> new ConcurrentHashMap<>())
                .put(session.getId(), new RoomUser(userId, userName));

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


    // =====================================================================
    // ▼ [HJW1] 채팅 메시지 처리 (Team Member Addition)
    // =====================================================================

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // 1. 들어온 메시지(JSON)를 읽음
        String payload = message.getPayload();
        Map<String, Object> data = objectMapper.readValue(payload, Map.class);

        String roomId = extractRoomId(session);
        String type = (String) data.get("type"); // 메시지 타입 확인 (예: "CHAT")

        // 2. 채팅 메시지라면 방 전체에 뿌림
        if ("CHAT".equals(type)) {
            String msgText = (String) data.get("message");
            String senderId = roomUsers.get(roomId).get(session.getId()).getUserId(); // 보낸 사람 ID 찾기

            // 보낼 데이터 조립
            Map<String, Object> chatData = new HashMap<>();
            chatData.put("type", "CHAT");
            chatData.put("userId", senderId);
            chatData.put("message", msgText);

            // 방에 있는 모든 사람에게 전송
            sendMessageToRoom(roomId, chatData);
        }
    }

    // [Helper] 채팅 메시지 전송용 (기존 broadcast는 유저 목록용이라 따로 만듬)
    private void sendMessageToRoom(String roomId, Map<String, Object> data) {
        Map<String, WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

        try {
            String payload = objectMapper.writeValueAsString(data);
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
}
