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

    private final ObjectMapper objectMapper;
    private final MeetingRoomService meetingRoomService;

    public RoomWebSocketHandler(ObjectMapper objectMapper, MeetingRoomService meetingRoomService) {
        this.objectMapper = objectMapper;
        this.meetingRoomService = meetingRoomService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomId = extractRoomId(session);
        Map<String, String> params = getParams(session);

        String userId = params.get("userId");
        String userName = params.get("userName");
        String userEmail = params.get("userEmail");
        String title = params.get("title");

        // isHost 파라미터 추출
        boolean isHost = "true".equals(params.get("isHost"));

        Boolean paramMuted = params.containsKey("muted")
                ? "true".equals(params.get("muted"))
                : null;

        Boolean paramCameraOff = params.containsKey("cameraOff")
                ? "true".equals(params.get("cameraOff"))
                : null;

        if (title == null || title.isBlank()) {
            title = "제목 없음";
        }

        // 방장이면 meeting_room에 저장, 모든 유저는 participant에 저장 (userEmail 사용)
        meetingRoomService.handleJoin(roomId, userEmail, title, isHost);

    /* =========================================================
       2. LEAVE 타이머 취소 (재접속 대응)
       ========================================================= */
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

    /* =========================================================
       3. 기존 유저 탐색 (재접속 판단)
       ========================================================= */
        for (Map.Entry<String, RoomUser> e : users.entrySet()) {
            RoomUser u = e.getValue();
            if (u != null && u.getUserId().equals(userId)) {
                restoredUser = u;
                existingSessionId = e.getKey();
                break;
            }
        }

    /* =========================================================
       4. 기존 세션 정리
       ========================================================= */
        if (existingSessionId != null) {
            WebSocketSession old = sessions.get(existingSessionId);
            if (old != null && old.isOpen()) {
                try { old.close(); } catch (Exception ignore) {}
            }
            sessions.remove(existingSessionId);
            users.remove(existingSessionId);
        }

        RoomUser finalUser;

    /* =========================================================
       5. RoomUser 생성 / 복원
       ========================================================= */
        if (restoredUser != null) {
            // 재접속 (같은 userId로 새 세션 — 기존 세션은 이미 정리됨)
            restoredUser.setExplicitlyLeft(false);
            restoredUser.setOnline(true);
            restoredUser.setUserEmail(userEmail);
            // 원래 방장(room host)이 재접속 시 클라이언트가 isHost=true로 보내므로 방장 권한 복귀
            restoredUser.setHost(isHost);

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

            // 신규 입장(또는 새로고침 후 재입장): isHost는 클라이언트가 room host 기준으로 전달 → 원래 방장 재접속 시 방장 복귀
            finalUser = new RoomUser(
                    userId,
                    userName,
                    userEmail,
                    isHost,
                    System.currentTimeMillis(),
                    false,
                    muted,
                    cameraOff,
                    false,
                    true,   // online = true
                    false,  // mutedByHost
                    false   // cameraOffByHost
            );
        }

    /* =========================================================
       6. 세션 등록 + 브로드캐스트
       ========================================================= */
        sessions.put(session.getId(), session);
        users.put(session.getId(), finalUser);

        // 원래 방장(room host)이 입장/재입장하면 이 방에서는 이 사람만 방장이어야 함 — 나머지는 즉시 isHost=false
        if (finalUser.isHost()) {
            String hostUserId = finalUser.getUserId();
            for (RoomUser u : users.values()) {
                if (u != null && !u.getUserId().equals(hostUserId)) {
                    u.setHost(false);
                }
            }
        }

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

        String userId = leavingUser.getUserId();

        // ✅ 기존 타이머가 있으면 취소
        Map<String, TimerTask> timerMap = leaveTimers.get(roomId);
        if (timerMap != null) {
            TimerTask t = timerMap.remove(userId);
            if (t != null) t.cancel();
        }

        // ✅ 연결 종료 시 즉시 유저 제거 (재접속 스피너 없이 바로 퇴장)
        users.remove(session.getId());
        System.out.println("🚪 [CONNECTION CLOSED] " + userId + " removed (refresh/disconnect — 방장 위임 안 함)");

        // DB에 퇴장 시간 기록
        meetingRoomService.handleLeave(roomId, leavingUser.getUserEmail(), leavingUser.isHost());

        // ❌ 연결 끊김(새로고침/네트워크 끊김) 시에는 방장 위임하지 않음.
        // 방장 위임은 명시적 LEAVE 메시지를 보낸 시점에서만 수행 (아래 handleTextMessage "LEAVE" 참고).
        // 원래 방장이 재접속하면 클라이언트가 isHost=true로 접속하므로 방장 권한 복귀.

        broadcast(roomId);
    }

    /**
     * 새 임시 방장 선정 (가장 먼저 입장한 참여자)
     */
    private void selectNewHost(String roomId, Map<String, WebSocketSession> sessions, Map<String, RoomUser> users) {
        if (users == null || users.isEmpty()) return;

        // 가장 먼저 입장한 유저를 새 방장으로 선정
        RoomUser newHost = users.values().stream()
                .filter(u -> u.isOnline() && !u.isExplicitlyLeft())
                .min(Comparator.comparingLong(RoomUser::getJoinAt))
                .orElse(null);

        if (newHost == null) return;

        // 새 방장으로 설정
        newHost.setHost(true);
        System.out.println("👑 [NEW HOST] " + newHost.getUserName() + " 님이 새 방장이 되었습니다.");

        // HOST_CHANGED 메시지 브로드캐스트
        try {
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "HOST_CHANGED",
                            "newHostUserId", newHost.getUserId(),
                            "newHostUserName", newHost.getUserName()
                    )
            );

            TextMessage message = new TextMessage(payload);
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(message);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void broadcast(String roomId) {
        Map<String, WebSocketSession> sessions = roomSessions.get(roomId);
        Map<String, RoomUser> usersMap = roomUsers.get(roomId);

        if (sessions == null || usersMap == null) return;

        List<RoomUser> users = usersMap.values().stream()
                .sorted(Comparator.comparingLong(RoomUser::getJoinAt))
                .toList();

        System.out.println("📢 [BROADCAST] Room: " + roomId + ", Users: " +
                users.stream().map(u -> u.getUserName() + "(online=" + u.isOnline() + ")")
                        .toList());

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
                // 방장이 강제로 끈 경우 참가자가 스스로 켤 수 없음 — 서버에서 무시
                if (changes.containsKey("muted")) {
                    Boolean newMuted = (Boolean) changes.get("muted");
                    if (Boolean.TRUE.equals(newMuted)) {
                        sender.setMuted(true);
                    } else {
                        if (!sender.getMutedByHost()) {
                            sender.setMuted(false);
                        }
                    }
                }
                if (changes.containsKey("cameraOff")) {
                    Boolean newCameraOff = (Boolean) changes.get("cameraOff");
                    if (Boolean.TRUE.equals(newCameraOff)) {
                        sender.setCameraOff(true);
                    } else {
                        if (!sender.getCameraOffByHost()) {
                            sender.setCameraOff(false);
                        }
                    }
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

            String leaverUserId = leaver.getUserId();
            boolean wasHost = leaver.isHost();

            leaver.setExplicitlyLeft(true);

            Map<String, TimerTask> timerMap = leaveTimers.get(roomId);
            if (timerMap != null) {
                TimerTask t = timerMap.remove(leaverUserId);
                if (t != null) t.cancel();
            }

            // ✅ 즉시 제거 (userId 기준)
            users.entrySet().removeIf(e ->
                    leaverUserId.equals(e.getValue().getUserId())
            );

            sessions.remove(session.getId());

            // DB에 퇴장 시간 기록
            meetingRoomService.handleLeave(roomId, leaver.getUserEmail(), leaver.isHost());

            // ✅ 방장이 나갔으면 새 임시 방장 선정
            if (wasHost) {
                selectNewHost(roomId, sessions, users);
            }

            broadcast(roomId);
            return;
        }

        if ("REACTION".equalsIgnoreCase(type)) {

            String emoji = inbound.getEmoji();
            if (emoji == null || emoji.isBlank()) return;

            // 그대로 room 전체에 브로드캐스트
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "REACTION",
                            "userId", sender.getUserId(),
                            "emoji", emoji
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

        // ============================================
        // 방장 권한 기능: FORCE_MUTE, FORCE_CAMERA_OFF, KICK
        // ============================================

        // 방장만 사용 가능한 기능
        if (!sender.isHost()) {
            // 방장이 아니면 무시
            if ("FORCE_MUTE".equalsIgnoreCase(type) ||
                "FORCE_CAMERA_OFF".equalsIgnoreCase(type) ||
                "FORCE_UNMUTE".equalsIgnoreCase(type) ||
                "FORCE_CAMERA_ON".equalsIgnoreCase(type) ||
                "KICK".equalsIgnoreCase(type)) {
                System.out.println("⚠️ 방장이 아닌 사용자가 방장 권한 기능 시도: " + sender.getUserName());
                return;
            }
        }

        // 마이크 강제 끄기
        if ("FORCE_MUTE".equalsIgnoreCase(type)) {
            String targetUserId = inbound.getTargetUserId();
            if (targetUserId == null || targetUserId.isBlank()) return;

            // 대상 유저 찾기
            RoomUser targetUser = findUserById(users, targetUserId);
            if (targetUser == null) return;

            // 상태 변경 (방장 강제이므로 참가자가 스스로 켤 수 없음)
            targetUser.setMuted(true);
            targetUser.setMutedByHost(true);

            // 대상에게 알림 + 전체 브로드캐스트
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "FORCE_MUTE",
                            "targetUserId", targetUserId,
                            "hostName", sender.getUserName()
                    )
            );

            TextMessage broadcastMessage = new TextMessage(payload);
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(broadcastMessage);
                }
            }

            // USERS_UPDATE도 브로드캐스트
            broadcast(roomId);
            return;
        }

        // 카메라 강제 끄기
        if ("FORCE_CAMERA_OFF".equalsIgnoreCase(type)) {
            String targetUserId = inbound.getTargetUserId();
            if (targetUserId == null || targetUserId.isBlank()) return;

            // 대상 유저 찾기
            RoomUser targetUser = findUserById(users, targetUserId);
            if (targetUser == null) return;

            // 상태 변경 (방장 강제이므로 참가자가 스스로 켤 수 없음)
            targetUser.setCameraOff(true);
            targetUser.setCameraOffByHost(true);

            // 대상에게 알림 + 전체 브로드캐스트
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "FORCE_CAMERA_OFF",
                            "targetUserId", targetUserId,
                            "hostName", sender.getUserName()
                    )
            );

            TextMessage broadcastMessage = new TextMessage(payload);
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(broadcastMessage);
                }
            }

            // USERS_UPDATE도 브로드캐스트
            broadcast(roomId);
            return;
        }

        // 마이크 강제 켜기 (방장이 허용)
        if ("FORCE_UNMUTE".equalsIgnoreCase(type)) {
            String targetUserId = inbound.getTargetUserId();
            if (targetUserId == null || targetUserId.isBlank()) return;

            RoomUser targetUser = findUserById(users, targetUserId);
            if (targetUser == null) return;

            targetUser.setMuted(false);
            targetUser.setMutedByHost(false);

            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "FORCE_UNMUTE",
                            "targetUserId", targetUserId,
                            "hostName", sender.getUserName()
                    )
            );
            TextMessage broadcastMessage = new TextMessage(payload);
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(broadcastMessage);
                }
            }
            broadcast(roomId);
            return;
        }

        // 카메라 강제 켜기 (방장이 허용)
        if ("FORCE_CAMERA_ON".equalsIgnoreCase(type)) {
            String targetUserId = inbound.getTargetUserId();
            if (targetUserId == null || targetUserId.isBlank()) return;

            RoomUser targetUser = findUserById(users, targetUserId);
            if (targetUser == null) return;

            targetUser.setCameraOff(false);
            targetUser.setCameraOffByHost(false);

            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "FORCE_CAMERA_ON",
                            "targetUserId", targetUserId,
                            "hostName", sender.getUserName()
                    )
            );
            TextMessage broadcastMessage = new TextMessage(payload);
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(broadcastMessage);
                }
            }
            broadcast(roomId);
            return;
        }

        // 강퇴
        if ("KICK".equalsIgnoreCase(type)) {
            String targetUserId = inbound.getTargetUserId();
            if (targetUserId == null || targetUserId.isBlank()) return;

            // 대상 유저 찾기
            RoomUser targetUser = findUserById(users, targetUserId);
            if (targetUser == null) return;

            // 대상의 세션 ID 찾기
            String targetSessionId = findSessionIdByUserId(users, targetUserId);

            // 강퇴 알림 브로드캐스트
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "KICKED",
                            "targetUserId", targetUserId,
                            "targetUserName", targetUser.getUserName(),
                            "hostName", sender.getUserName()
                    )
            );

            TextMessage broadcastMessage = new TextMessage(payload);
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(broadcastMessage);
                }
            }

            // 유저 제거
            if (targetSessionId != null) {
                users.remove(targetSessionId);
                WebSocketSession targetSession = sessions.remove(targetSessionId);
                if (targetSession != null && targetSession.isOpen()) {
                    try {
                        targetSession.close();
                    } catch (Exception ignore) {}
                }
            }

            // DB에 퇴장 시간 기록
            meetingRoomService.handleLeave(roomId, targetUser.getUserEmail(), targetUser.isHost());

            // USERS_UPDATE 브로드캐스트
            broadcast(roomId);
            return;
        }
    }

    /**
     * userId로 RoomUser 찾기
     */
    private RoomUser findUserById(Map<String, RoomUser> users, String userId) {
        return users.values().stream()
                .filter(u -> userId.equals(u.getUserId()))
                .findFirst()
                .orElse(null);
    }

    /**
     * userId로 세션 ID 찾기
     */
    private String findSessionIdByUserId(Map<String, RoomUser> users, String userId) {
        for (Map.Entry<String, RoomUser> entry : users.entrySet()) {
            if (userId.equals(entry.getValue().getUserId())) {
                return entry.getKey();
            }
        }
        return null;
    }
}
