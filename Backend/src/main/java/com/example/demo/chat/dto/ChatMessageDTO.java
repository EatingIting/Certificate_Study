package com.example.demo.chat.dto;

import lombok.Data;

@Data
public class ChatMessageDTO {
    private String roomId;
    private String userId;
    private String userName;  // 보낸 사람 이름
    private String message;
    private String type;      // 메시지 타입 (TALK, ENTER, AI 등) - 이거 하나만 있어야 해요!
    private String createdAt; // 생성 시간 (선택 사항)
}