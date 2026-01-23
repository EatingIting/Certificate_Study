package com.example.demo.roomcreate;

import java.util.List;

public interface RoomCreateService {
    void insertRoom(RoomCreateRequest request, String userId);
    List<RoomCreateVO> getRooms();
    RoomCreateVO getRoomDetail(String roomId);
}
