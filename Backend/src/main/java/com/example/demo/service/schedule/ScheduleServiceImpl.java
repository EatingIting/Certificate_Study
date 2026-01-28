package com.example.demo.service.schedule;

import com.example.demo.dto.schedule.ScheduleCreateRequest;
import com.example.demo.dto.schedule.ScheduleUpdateRequest;
import com.example.demo.schedule.mapper.ScheduleMapper;
import com.example.demo.schedule.vo.ScheduleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleMapper scheduleMapper;

    @Override
    public List<ScheduleVO> selectByRange(String roomId, Date start, Date endExclusive) {
        return scheduleMapper.selectByRange(roomId, start, endExclusive); // mapper 그대로 :contentReference[oaicite:2]{index=2}
    }

    @Override
    @Transactional
    public Long insert(ScheduleCreateRequest req) {
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
                .userId(req.getUserId())
                .title(req.getTitle().trim())
                .description(req.getDescription())
                .startAt(Date.valueOf(startAt))
                .endAt(Date.valueOf(endAt)) // DB는 inclusive
                .type(type)
                .colorHex(req.getColorHex())
                .customTypeLabel(customTypeLabel)
                .build();

        scheduleMapper.insert(vo); // mapper 그대로 :contentReference[oaicite:3]{index=3}
        return vo.getScheduleId();
    }

    @Override
    @Transactional
    public void update(Long scheduleId, ScheduleUpdateRequest req) {
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
                .title(req.getTitle().trim())
                .description(req.getDescription())
                .startAt(Date.valueOf(startAt))
                .endAt(Date.valueOf(endAt))
                .type(type)
                .colorHex(req.getColorHex())
                .customTypeLabel(customTypeLabel)
                .build();

        int updated = scheduleMapper.update(vo); // mapper 그대로 :contentReference[oaicite:4]{index=4}
        if (updated == 0) {
            throw new IllegalArgumentException("해당 일정이 없거나 수정할 수 없습니다. scheduleId=" + scheduleId);
        }
    }

    @Override
    @Transactional
    public void softDelete(Long scheduleId, String roomId, String userId) {
        int deleted = scheduleMapper.softDelete(scheduleId, roomId, userId); // mapper 그대로 :contentReference[oaicite:5]{index=5}
        if (deleted == 0) {
            throw new IllegalArgumentException("해당 일정이 없거나 삭제할 수 없습니다. scheduleId=" + scheduleId);
        }
    }
}