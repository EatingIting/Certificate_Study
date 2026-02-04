package com.example.demo.board.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class CommentNotificationWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, WebSocketSession> sessions =
            new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    public CommentNotificationWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {

        String userId = extractUserId(session);
        sessions.put(userId, session);

        System.out.println("댓글 WebSocket 연결됨: " + userId);
        System.out.println("현재 sessions 목록: " + sessions.keySet());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {

        String userId = extractUserId(session);
        sessions.remove(userId);

        System.out.println("댓글 WebSocket 종료됨: " + userId);
    }

    public void sendCommentNotification(
            String userId,
            String roomId,
            Long postId,
            String postTitle,
            String commentPreview
    ) {

        System.out.println("댓글 알림 sendCommentNotification 실행됨");
        System.out.println("대상 userId = " + userId);
        System.out.println("현재 sessions 목록 = " + sessions.keySet());

        WebSocketSession session = sessions.get(userId);

        if (session == null) {
            System.out.println("세션 없음 (userId 미접속)");
            return;
        }

        if (!session.isOpen()) {
            System.out.println("세션 닫힘 상태");
            return;
        }

        try {
            String payload = objectMapper.writeValueAsString(
                    Map.of(
                            "type", "COMMENT",
                            "roomId", roomId,
                            "postId", postId,
                            "postTitle", postTitle,
                            "content", commentPreview
                    )
            );

            System.out.println("보내는 payload = " + payload);

            session.sendMessage(new TextMessage(payload));

            System.out.println("댓글 알림 전송 성공");

        } catch (Exception e) {
            System.out.println("댓글 알림 전송 실패");
            e.printStackTrace();
        }
    }



    private String extractUserId(WebSocketSession session) {
        String path = session.getUri().getPath();
        return path.substring(path.lastIndexOf("/") + 1);
    }
}
