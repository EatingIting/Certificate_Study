package com.example.demo.dto.roomparticipant;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class KickMemberRequest {
    private String targetUserId;
}
