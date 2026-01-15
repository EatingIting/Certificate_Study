package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatInboundMessage {
    private String type;
    private String roomId;
    private String userId;
    private String userName;
    private String message;

    public ChatInboundMessage() {
    }
}
