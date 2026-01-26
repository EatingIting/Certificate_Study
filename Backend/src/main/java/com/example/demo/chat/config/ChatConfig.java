package com.example.demo.chat.config;

import com.example.demo.chat.handler.ChatWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class ChatConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 🚨 중요: 주소를 "/ws/room" -> "/ws/chat"으로 변경!
        // 이렇게 하면 팀장님 거랑 충돌 안 남
        registry.addHandler(chatWebSocketHandler, "/ws/chat/*")
                .setAllowedOrigins("*");
    }
}