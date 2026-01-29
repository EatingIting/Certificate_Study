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
        // ws://localhost:8080/ws/chat/{roomId} 주소로 연결
        registry.addHandler(chatWebSocketHandler, "/ws/chat/**")
                .setAllowedOrigins("*"); // 모든 도메인에서 접속 허용 (배포 시 보안 주의)
    }
}