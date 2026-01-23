package com.example.demo.service;

import com.example.demo.domain.Schedule;
import com.example.demo.dto.ScheduleCreateRequest;
import com.example.demo.dto.ScheduleResponse;
import com.example.demo.dto.ScheduleUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;

    // 일정 생성
    @Override
    public ScheduleResponse createSchedule(String roomId, ScheduleCreateRequest request) {

        String userId = getCurrentUserId();

        Schedule schedule = new Schedule();
        schedule.setRoomId(roomId);
        schedule.setUserId(userId);

        schedule.setTitle(request.getTitle());
        schedule.setDescription(request.getDescription());
        schedule.setStartAt(request.getStartAt());
        schedule.setEndAt(request.getEndAt());
        schedule.setType(request.getType());
        schedule.setColorHex(request.getColorHex());
        schedule.setCustomTypeLabel(request.getCustomTypeLabel());

        Schedule saved = scheduleRepository.save(schedule);

        return ScheduleResponse.builder()
                .scheduleId(saved.getScheduleId())
                .roomId(saved.getRoomId())
                .userId(saved.getUserId())
                .title(saved.getTitle())
                .description(saved.getDescription())
                .startAt(saved.getStartAt())
                .endAt(saved.getEndAt())
                .type(saved.getType())
                .colorHex(saved.getColorHex())
                .customTypeLabel(saved.getCustomTypeLabel())
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt())
                .build();
    }

    // 일정 목록 조회
    @Override
    @Transactional(readOnly = true)
    public List<ScheduleResponse> getSchedules(String roomId, LocalDate from, LocalDate to) {

        return scheduleRepository
                .findByRoomIdAndStartAtLessThanEqualAndEndAtGreaterThanEqualOrderByStartAtAsc(roomId, to, from)
                .stream()
                .filter(s -> s.getDeletedAt() == null)
                .map(s -> ScheduleResponse.builder()
                        .scheduleId(s.getScheduleId())
                        .roomId(s.getRoomId())
                        .userId(s.getUserId())
                        .title(s.getTitle())
                        .description(s.getDescription())
                        .startAt(s.getStartAt())
                        .endAt(s.getEndAt())
                        .type(s.getType())
                        .colorHex(s.getColorHex())
                        .customTypeLabel(s.getCustomTypeLabel())
                        .createdAt(s.getCreatedAt())
                        .updatedAt(s.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    // 일정 수정
    @Override
    public ScheduleResponse updateSchedule(Long scheduleId, ScheduleUpdateRequest request) {

        // 수정할 일정 찾기(없으면 예외 발생)
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("해당 일정이 없습니다. id=" + scheduleId));

        // soft delete된 일정이면 수정 막기
        if (schedule.getDeletedAt() != null) {
            throw new IllegalArgumentException("삭제된 일정은 수정할 수 없습니다. id=" + scheduleId);
        }

        // null이 아닌 값만 수정 반영
        if (request.getTitle() != null) {
            schedule.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            schedule.setDescription(request.getDescription());
        }
        if (request.getStartAt() != null) {
            schedule.setStartAt(request.getStartAt());
        }
        if (request.getEndAt() != null) {
            schedule.setEndAt(request.getEndAt());
        }
        if (request.getType() != null) {
            schedule.setType(request.getType());
        }
        if (request.getColorHex() != null) {
            schedule.setColorHex(request.getColorHex());
        }
        if (request.getCustomTypeLabel() != null) {
            schedule.setCustomTypeLabel(request.getCustomTypeLabel());
        }

        Schedule saved = scheduleRepository.save(schedule);

        return ScheduleResponse.builder()
                .scheduleId(saved.getScheduleId())
                .roomId(saved.getRoomId())
                .userId(saved.getUserId())
                .title(saved.getTitle())
                .description(saved.getDescription())
                .startAt(saved.getStartAt())
                .endAt(saved.getEndAt())
                .type(saved.getType())
                .colorHex(saved.getColorHex())
                .customTypeLabel(saved.getCustomTypeLabel())
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt())
                .build();
    }

    // 일정 삭제
    @Override
    public void deleteSchedule(Long scheduleId) {

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("해당 일정이 없습니다. id=" + scheduleId));

        if (schedule.getDeletedAt() != null) {
            throw new IllegalArgumentException("이미 삭제된 일정입니다. id=" + scheduleId);
        }

        schedule.setDeletedAt(java.time.LocalDateTime.now());
        scheduleRepository.save(schedule);
    }


    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || auth.getPrincipal() == null) {
            throw new IllegalStateException("로그인 정보가 없습니다.");
        }

        return auth.getPrincipal().toString(); // principal = userId(UUID)
    }
}
