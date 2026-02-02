package com.example.demo.LMS회원.Service;

public interface LmsAccessService {
    boolean hasAccessToRoom(String userEmail, String roomId);
    boolean hasAccessToAnyRoom(String userEmail);
    boolean isHost(String userEmail, String roomId);
}
