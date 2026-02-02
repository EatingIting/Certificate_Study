package com.example.demo.roommypage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyRoomItem {
    private String roomId;
    private String title;
    private boolean isHost; // 방장 여부
}