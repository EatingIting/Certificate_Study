package com.example.demo.notification;

import com.example.demo.board.handler.CommentNotificationWebSocketHandler;
import com.example.demo.모집.handler.NotificationWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@RequiredArgsConstructor
public class NotificationWebSocketConfig implements WebSocketConfigurer {

    private final NotificationWebSocketHandler notificationWebSocketHandler;
    private final CommentNotificationWebSocketHandler commentNotificationWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(notificationWebSocketHandler, "/ws/notification/**")
                .setAllowedOrigins("*");

        registry.addHandler(commentNotificationWebSocketHandler, "/ws/comment/**")
                .setAllowedOrigins("*");
    }
}
