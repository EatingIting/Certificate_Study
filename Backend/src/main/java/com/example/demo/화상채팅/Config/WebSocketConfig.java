package com.example.demo.화상채팅.Config;

import com.example.demo.모집.handler.NotificationWebSocketHandler;
import com.example.demo.화상채팅.Handler.RoomWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RoomWebSocketHandler roomHandler;
    private final NotificationWebSocketHandler notificationHandler;

    public WebSocketConfig(RoomWebSocketHandler roomHandler,
                           NotificationWebSocketHandler notificationHandler) {
        this.roomHandler = roomHandler;
        this.notificationHandler = notificationHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {

        // 채팅용 WebSocket
        registry.addHandler(roomHandler, "/ws/room/{roomId}")
                .setAllowedOrigins("*");

        // 방장 알림용 WebSocket
        registry.addHandler(notificationHandler, "/ws/notification/{userId}")
                .setAllowedOriginPatterns("*");
    }
}