package com.example.demo.화상채팅.Service;

import org.springframework.stereotype.Service;

@Service
public interface MeetingRoomService {
    String getRoomIdBySubjectId(String subjectId);
}
