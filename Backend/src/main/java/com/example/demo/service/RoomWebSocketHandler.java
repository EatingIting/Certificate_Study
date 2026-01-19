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
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import com.example.demo.dto.RoomUser;

@Component
public class RoomWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, Map<String, WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    private final Map<String, Map<String, RoomUser>> roomUsers = new ConcurrentHashMap<>();

    private final Map<String, Map<String, TimerTask>> leaveTimers = new ConcurrentHashMap<>();
    private final Timer timer = new Timer(true);

    private final ObjectMapper objectMapper;

    private static final long LEAVE_GRACE_MS = 8000;

    public RoomWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomId = extractRoomId(session);
        Map<String, String> params = getParams(session);

        String userId = params.get("userId");
        String userName = params.get("userName");

        Boolean paramMuted = params.containsKey("muted")
                ? "true".equals(params.get("muted"))
                : null;

        Boolean paramCameraOff = params.containsKey("cameraOff")
                ? "true".equals(params.get("cameraOff"))
                : null;

        Map<String, TimerTask> roomTimerMap = leaveTimers.get(roomId);
        if (roomTimerMap != null) {
            TimerTask t = roomTimerMap.remove(userId);
            if (t != null) t.cancel();
        }

        Map<String, RoomUser> users =
                roomUsers.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());

        Map<String, WebSocketSession> sessions =
                roomSessions.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());

        RoomUser restoredUser = null;
        String existingSessionId = null;

        // ✅ 기존 유저 상태 탐색 (재접속)
        for (Map.Entry<String, RoomUser> e : users.entrySet()) {
            RoomUser u = e.getValue();
            if (u != null && u.getUserId().equals(userId)) {
                restoredUser = u;
                existingSessionId = e.getKey();
                break;
            }
        }

        // 기존 세션 정리
        if (existingSessionId != null) {
            WebSocketSession old = sessions.get(existingSessionId);
            if (old != null && old.isOpen()) {
                try { old.close(); } catch (Exception ignore) {}
            }
            sessions.remove(existingSessionId);
            users.remove(existingSessionId);
        }

        RoomUser finalUser;

        if (restoredUser != null) {
            // ✅ 재접속 or 재입장 → LEAVE 상태 해제
            restoredUser.setExplicitlyLeft(false);

            // ⭐ 쿼리 파라미터로 상태 업데이트 (재접속 시에도 적용)
            if (paramMuted != null) {
                restoredUser.setMuted(paramMuted);
            }
            if (paramCameraOff != null) {
                restoredUser.setCameraOff(paramCameraOff);
            }

            finalUser = restoredUser;
        } else {
            boolean muted = paramMuted != null ? paramMuted : true;
            boolean cameraOff = paramCameraOff != null ? paramCameraOff : true;

            finalUser = new RoomUser(
                    userId,
                    userName,
                    System.currentTimeMillis(),
                    false,
                    muted,
                    cameraOff,
                    false
            );
        }

        // 세션 등록
        sessions.put(session.getId(), session);
        users.put(session.getId(), finalUser);

        broadcast(roomId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = extractRoomId(session);

        Map<String, WebSocketSession> sessions = roomSessions.get(roomId);
        Map<String, RoomUser> users = roomUsers.get(roomId);

        if (sessions == null || users == null) return;

        RoomUser leavingUser = users.get(session.getId());

        // 세션은 항상 제거
        sessions.remove(session.getId());

        if (leavingUser == null) {
            broadcast(roomId);
            return;
        }

        // ✅ LEAVE로 이미 처리된 유저면 여기서 끝
        if (leavingUser.isExplicitlyLeft()) {
            users.remove(session.getId());
            broadcast(roomId);
            return;
        }

        String userId = leavingUser.getUserId();

        // ✅ 재접속 유예 타이머 설정
        leaveTimers.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());

        TimerTask oldTask = leaveTimers.get(roomId).remove(userId);
        if (oldTask != null) oldTask.cancel();

        TimerTask task = new TimerTask() {
            @Override
            public void run() {
                Map<String, RoomUser> uMap = roomUsers.get(roomId);
                if (uMap == null) return;

                // userId 기준 제거
                uMap.entrySet().removeIf(e ->
                        userId.equals(e.getValue().getUserId())
                );

                broadcast(roomId);
            }
        };

        leaveTimers.get(roomId).put(userId, task);
        timer.schedule(task, LEAVE_GRACE_MS);

        // 재접속 중 표시를 위해 즉시 broadcast
        broadcast(roomId);
    }

    private void broadcast(String roomId) {
        Map<String, WebSocketSession> sessions = roomSessions.get(roomId);
        Map<String, RoomUser> usersMap = roomUsers.get(roomId);

        if (sessions == null || usersMap == null) return;

        List<RoomUser> users = usersMap.values().stream()
                .sorted(Comparator.comparingLong(RoomUser::getJoinAt))
                .toList();

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
            List<RoomUser> userList = users.values().stream()
                    .sorted(Comparator.comparingLong(RoomUser::getJoinAt))
                    .toList();

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
        if ("PING".equalsIgnoreCase(type)) {
            session.sendMessage(new TextMessage("{\"type\":\"PONG\"}"));
            return;
        }

        if ("LEAVE".equalsIgnoreCase(type)) {

            RoomUser leaver = users.get(session.getId());
            if (leaver == null) return;

            String userId = leaver.getUserId();

            leaver.setExplicitlyLeft(true);

            Map<String, TimerTask> timerMap = leaveTimers.get(roomId);
            if (timerMap != null) {
                TimerTask t = timerMap.remove(userId);
                if (t != null) t.cancel();
            }

            // ✅ 즉시 제거 (userId 기준)
            users.entrySet().removeIf(e ->
                    userId.equals(e.getValue().getUserId())
            );

            sessions.remove(session.getId());

            broadcast(roomId);
            return;
        }
    }
}
