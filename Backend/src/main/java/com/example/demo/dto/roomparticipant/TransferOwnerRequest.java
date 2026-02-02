package com.example.demo.dto.roomparticipant;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TransferOwnerRequest {
    private String targetUserId; // 필수
}