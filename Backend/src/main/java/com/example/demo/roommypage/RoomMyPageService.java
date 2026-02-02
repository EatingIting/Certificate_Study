package com.example.demo.roommypage;

import com.example.demo.roommypage.dto.MyRoomItem;
import com.example.demo.roommypage.dto.RoomMyPageResponse;

import java.util.List;

public interface RoomMyPageService {

    RoomMyPageResponse getRoomMyPage(String roomId, String principal);

    RoomMyPageResponse updateRoomNickname(String roomId, String principal, String roomNickname);

    List<MyRoomItem> getMyRooms(String principal);
}