package com.example.demo.notification;

import com.example.demo.roomparticipant.RoomParticipantMapper;
import com.example.demo.roomparticipant.RoomParticipantVO;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.모집.handler.NotificationWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class LmsNotificationService {

    private final RoomParticipantMapper roomParticipantMapper;
    private final NotificationWebSocketHandler notificationWebSocketHandler;
    private final AuthService authService;

    public void notifyAssignmentCreated(String roomId, Long assignmentId, String assignmentTitle, String actorEmail) {
        String actorUserId = resolveUserId(actorEmail);
        String safeTitle = safeText(assignmentTitle, "과제 알림");
        String content = "새 과제가 등록되었습니다.";

        for (String userId : resolveRecipientUserIds(roomId, actorUserId)) {
            notificationWebSocketHandler.sendLmsNotification(
                    userId,
                    "ASSIGNMENT",
                    roomId,
                    assignmentId,
                    null,
                    safeTitle,
                    content
            );
        }
    }

    public void notifyScheduleCreated(String roomId, Long scheduleId, String scheduleTitle, String actorEmail) {
        String actorUserId = resolveUserId(actorEmail);
        String safeTitle = safeText(scheduleTitle, "일정 알림");
        String content = "새 일정이 등록되었습니다.";

        for (String userId : resolveRecipientUserIds(roomId, actorUserId)) {
            notificationWebSocketHandler.sendLmsNotification(
                    userId,
                    "SCHEDULE",
                    roomId,
                    null,
                    scheduleId,
                    safeTitle,
                    content
            );
        }
    }

    public void notifyStudyScheduleCreated(String roomId, Long studyScheduleId, Integer roundNum, LocalDate studyDate, String actorEmail) {
        String actorUserId = resolveUserId(actorEmail);
        String title = (roundNum != null ? roundNum + "회차" : "스터디") + " 일정";
        String dateText = studyDate != null ? " (" + studyDate + ")" : "";
        String content = "새 스터디 일정이 등록되었습니다." + dateText;

        for (String userId : resolveRecipientUserIds(roomId, actorUserId)) {
            notificationWebSocketHandler.sendLmsNotification(
                    userId,
                    "SCHEDULE",
                    roomId,
                    null,
                    studyScheduleId,
                    title,
                    content
            );
        }
    }

    private Set<String> resolveRecipientUserIds(String roomId, String actorUserId) {
        Set<String> userIds = new LinkedHashSet<>();

        RoomParticipantVO host = roomParticipantMapper.selectHostParticipant(roomId);
        if (host != null && hasText(host.getUserId())) {
            userIds.add(host.getUserId());
        }

        List<RoomParticipantVO> members = roomParticipantMapper.selectApprovedParticipants(roomId);
        if (members != null) {
            for (RoomParticipantVO member : members) {
                if (member != null && hasText(member.getUserId())) {
                    userIds.add(member.getUserId());
                }
            }
        }

        if (hasText(actorUserId)) {
            userIds.remove(actorUserId);
        }

        return userIds;
    }

    private String resolveUserId(String email) {
        if (!hasText(email)) return null;
        AuthVO user = authService.findByEmail(email.trim());
        if (user == null || !hasText(user.getUserId())) return null;
        return user.getUserId();
    }

    private String safeText(String text, String defaultValue) {
        String value = Objects.toString(text, "").trim();
        return value.isEmpty() ? defaultValue : value;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
