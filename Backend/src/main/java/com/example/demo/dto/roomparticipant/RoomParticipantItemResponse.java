package com.example.demo.dto.roomparticipant;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class RoomParticipantItemResponse {
    private String id;        // user_id (프론트에서 id로 쓰기 좋게)
    private String name;      // name 우선, 없으면 nickname
    private String email;
    private String role;      // "OWNER" | "MEMBER"
    private String profileImg;
    private LocalDateTime joinedAt;
}