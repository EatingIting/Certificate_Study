package com.example.demo.화상채팅.Controller;

import com.example.demo.화상채팅.Service.MeetingRoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/meeting-rooms")
@CrossOrigin(origins = "*")
public class MeetingRoomController {

    private final MeetingRoomService meetingRoomService;

    @GetMapping("/room-id/{subjectId}")
    public Map<String, String> getRoomIdBySubjectId(@PathVariable String subjectId) {
        log.info("[MeetingRoomController] getRoomIdBySubjectId 호출: subjectId={}", subjectId);
        String roomId = meetingRoomService.getRoomIdBySubjectId(subjectId);
        log.info("[MeetingRoomController] roomId 생성 완료: subjectId={}, roomId={}", subjectId, roomId);
        return Map.of("roomId", roomId);
    }
}
