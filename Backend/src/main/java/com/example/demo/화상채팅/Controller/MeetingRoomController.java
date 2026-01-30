package com.example.demo.화상채팅.Controller;

import com.example.demo.화상채팅.Service.MeetingRoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/meeting-rooms")
@CrossOrigin(origins = "*")
public class MeetingRoomController {

    private final MeetingRoomService meetingRoomService;

    /** 화상방 입장 시 roomId + 오늘 회차 scheduleId 반환 (scheduleId 실패 시에도 roomId는 반환해 입장 가능) */
    @GetMapping("/room-id/{subjectId}")
    public Map<String, Object> getRoomIdBySubjectId(@PathVariable String subjectId) {
        log.info("[MeetingRoomController] getRoomIdBySubjectId 호출: subjectId={}", subjectId);
        String roomId = meetingRoomService.getRoomIdBySubjectId(subjectId);
        Map<String, Object> result = new HashMap<>();
        result.put("roomId", roomId);
        try {
            Long scheduleId = meetingRoomService.getOrCreateTodayScheduleId(subjectId);
            result.put("scheduleId", scheduleId);
            log.info("[MeetingRoomController] roomId/scheduleId 반환: subjectId={}, roomId={}, scheduleId={}", subjectId, roomId, scheduleId);
        } catch (Exception e) {
            log.warn("[MeetingRoomController] 오늘 회차 조회/생성 실패, roomId만 반환. subjectId={}, roomId={}, error={}", subjectId, roomId, e.getMessage());
            result.put("scheduleId", null);
        }
        return result;
    }
}
