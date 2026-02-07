package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.ScheduleCreateRequest;
import com.example.demo.dto.schedule.ScheduleEventResponse;
import com.example.demo.dto.schedule.ScheduleUpdateRequest;
import com.example.demo.roomcontext.CurrentUserUtil;
import com.example.demo.roomparticipant.RoomParticipantMapper;
import com.example.demo.schedule.converter.ScheduleEventConverter;
import com.example.demo.schedule.mapper.ScheduleMapper;
import com.example.demo.schedule.vo.ScheduleVO;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleMapper scheduleMapper;
    private final RoomParticipantMapper roomParticipantMapper;
    private final CurrentUserUtil currentUserUtil;
    private final AuthService authService;

    private void requireHost(String roomId, String email) {
        String hostEmail = roomParticipantMapper.selectHostEmail(roomId);
        if (hostEmail == null || email == null || !hostEmail.trim().equals(email.trim())) {
            throw new AccessDeniedException("방장만 접근 가능합니다.");
        }
    }

    private String getUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);
        if (user == null) {
            throw new IllegalStateException("유저를 찾을 수 없습니다.");
        }
        return user.getUserId();
    }

    @Override
    public List<ScheduleVO> selectByRange(String roomId, Date start, Date endExclusive) {
        return scheduleMapper.selectByRange(roomId, start, endExclusive);
    }

    @Override
    public ScheduleVO selectNextExam(String roomId) {
        return scheduleMapper.selectNextExam(roomId);
    }

    @Override
    @Transactional
    public Long insert(ScheduleCreateRequest req) {
        String email = currentUserUtil.getCurrentUserEmail();
        requireHost(req.getRoomId(), email);

        String userId = getUserIdByEmail(email);

        LocalDate startAt = LocalDate.parse(req.getStart());
        LocalDate endAt = (req.getEnd() == null || req.getEnd().isBlank())
                ? startAt
                : LocalDate.parse(req.getEnd());

        if (endAt.isBefore(startAt)) {
            throw new IllegalArgumentException("종료일은 시작일 이후여야 합니다.");
        }

        String type = req.getType();

        String customTypeLabel = ("OTHER".equals(type) && req.getCustomLabel() != null && !req.getCustomLabel().isBlank())
                ? req.getCustomLabel().trim()
                : null;

        ScheduleVO vo = ScheduleVO.builder()
                .roomId(req.getRoomId())
                .userId(userId)
                .title(req.getTitle().trim())
                .description(req.getDescription())
                .startAt(Date.valueOf(startAt))
                .endAt(Date.valueOf(endAt)) // DB는 inclusive
                .type(type)
                .colorHex(req.getColorHex())
                .textColor((req.getTextColor() == null || req.getTextColor().isBlank()) ? "#ffffff" : req.getTextColor().trim())
                .customTypeLabel(customTypeLabel)
                .build();

        scheduleMapper.insert(vo); // mapper 그대로 :contentReference[oaicite:3]{index=3}
        return vo.getScheduleId();
    }

    @Override
    @Transactional
    public void update(Long scheduleId, String roomId, ScheduleUpdateRequest req) {
        String email = currentUserUtil.getCurrentUserEmail();
        requireHost(roomId, email);

        LocalDate startAt = LocalDate.parse(req.getStart());
        LocalDate endAt = (req.getEnd() == null || req.getEnd().isBlank())
                ? startAt
                : LocalDate.parse(req.getEnd());

        if (endAt.isBefore(startAt)) {
            throw new IllegalArgumentException("종료일은 시작일 이후여야 합니다.");
        }

        String type = req.getType();

        String customTypeLabel = ("OTHER".equals(type) && req.getCustomLabel() != null && !req.getCustomLabel().isBlank())
                ? req.getCustomLabel().trim()
                : null;

        ScheduleVO vo = ScheduleVO.builder()
                .scheduleId(scheduleId)
                .roomId(roomId)
                .title(req.getTitle().trim())
                .description(req.getDescription())
                .startAt(Date.valueOf(startAt))
                .endAt(Date.valueOf(endAt))
                .type(type)
                .colorHex(req.getColorHex())
                .textColor((req.getTextColor() == null || req.getTextColor().isBlank()) ? "#ffffff" : req.getTextColor().trim())
                .customTypeLabel(customTypeLabel)
                .build();

        int updated = scheduleMapper.update(vo); // mapper 그대로 :contentReference[oaicite:4]{index=4}
        if (updated == 0) {
            throw new IllegalArgumentException("해당 일정이 없거나 수정할 수 없습니다. scheduleId=" + scheduleId);
        }
    }

    @Override
    @Transactional
    public void softDelete(Long scheduleId, String roomId) {
        String email = currentUserUtil.getCurrentUserEmail();
        requireHost(roomId, email);

        int deleted = scheduleMapper.softDelete(scheduleId, roomId); // mapper 그대로 :contentReference[oaicite:5]{index=5}
        if (deleted == 0) {
            throw new IllegalArgumentException("해당 일정이 없거나 삭제할 수 없습니다. scheduleId=" + scheduleId);
        }
    }

    @Override
    public List<ScheduleEventResponse> getEvents(String roomId, String start, String end) {

        Date s = Date.valueOf(LocalDate.parse(start));
        Date e = Date.valueOf(LocalDate.parse(end));

        List<ScheduleVO> list = scheduleMapper.selectByRange(roomId, s, e);

        return list.stream()
                .map(ScheduleEventConverter::fromSchedule)
                .toList();
    }
}