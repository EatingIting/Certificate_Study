package com.example.demo.chat.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class ChatMessageDTO {
    // 메시지 타입 (입장, 대화)
    public enum MessageType {
        ENTER, TALK
    }

    private MessageType type; // 메시지 타입
    private Long roomId;      // 방 번호
    private String userId;    // 보낸 사람 ID
    private String userName;  // 보낸 사람 닉네임 (프론트 표시용)
    private String message;   // 내용
}