package com.example.demo.dto.roomcontext;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class RoomContextResponse {
    private String roomId;
    private String title;
    private String myRole; // "OWNER" | "MEMBER" | "NONE"
}