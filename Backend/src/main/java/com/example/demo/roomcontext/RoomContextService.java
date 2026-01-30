package com.example.demo.roomcontext;

import com.example.demo.dto.roomcontext.RoomContextResponse;

public interface RoomContextService {
    RoomContextResponse getRoomContext(String roomId);
}