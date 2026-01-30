package com.example.demo.화상채팅.DTO;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChatOutboundMessage {
    private String type;
    private String roomId;
    private String userId;
    private String userName;
    private String message;
    private long timestamp;

    public ChatOutboundMessage(String roomId, String userId, String userName, String message, long timestamp) {
        this.type = "CHAT";
        this.roomId = roomId;
        this.userId = userId;
        this.userName = userName;
        this.message = message;
        this.timestamp = timestamp;
    }
}
