package com.example.demo.roomprofile;

public interface RoomNicknameService {
    String getMyNickname(String roomId, String userEmail);
    String updateMyNickname(String roomId, String userEmail, String nickname);
}