package com.example.demo.dto.roomparticipant;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
public class RoomParticipantListResponse {
    private String roomId;
    private String myRole;            // "OWNER" | "MEMBER"
    private int memberCount;
    private List<RoomParticipantItemResponse> participants;
}