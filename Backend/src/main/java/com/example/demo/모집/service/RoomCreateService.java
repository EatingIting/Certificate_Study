package com.example.demo.모집.service;

import com.example.demo.모집.request.RoomCreateRequest;
import com.example.demo.모집.vo.RoomCreateVO;

import java.util.List;

public interface RoomCreateService {

    void insertRoom(RoomCreateRequest request, String userId);

    void updateRoom(String roomId, RoomCreateRequest request, String userEmail);

    List<RoomCreateVO> getRooms();

    RoomCreateVO getRoomDetail(String roomId);
}
