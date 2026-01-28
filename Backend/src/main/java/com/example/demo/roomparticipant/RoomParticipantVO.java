package com.example.demo.roomparticipant;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class RoomParticipantVO {

    // users
    private String userId;       // users.user_id
    private String email;        // users.email
    private String name;         // users.name
    private String nickname;     // users.nickname
    private String profileImg;   // users.profile_img

    // room_join_request
    private LocalDateTime joinedAt; // rjr.requested_at (승인 시점 기준으로 사용)
}