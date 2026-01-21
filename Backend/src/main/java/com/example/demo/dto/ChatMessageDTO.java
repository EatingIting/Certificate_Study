package com.example.demo.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class ChatMessageDTO {
    private Long roomId;    // 방 번호
    private String userId;  // 보내는 사람 (Writer)
    private String message; // 내용
}
