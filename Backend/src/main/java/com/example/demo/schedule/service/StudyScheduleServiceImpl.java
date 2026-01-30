package com.example.demo.schedule.service;


import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.schedule.mapper.StudyScheduleMapper;
import com.example.demo.schedule.vo.StudyScheduleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StudyScheduleServiceImpl implements StudyScheduleService {

    private final StudyScheduleMapper studyScheduleMapper;

    @Override
    public List<StudyScheduleVO> selectByRange(String roomId, Date start, Date endExclusive) {
        return studyScheduleMapper.selectByRange(roomId, start, endExclusive);
    }

    @Override
    public List<StudyScheduleVO> selectAnyBySubjectId(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return List.of();
        try {
            return studyScheduleMapper.selectAnyBySubjectId(subjectId);
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String normalizeTime(String time) {
        if (time == null || time.isBlank()) return null;
        String t = time.trim();
        if (t.length() == 5) return t + ":00"; // HH:mm -> HH:mm:00
        return t;
    }

    @Override
    @Transactional
    public Long insert(StudyScheduleCreateRequest req) {
        String subjectId = req.getRoomId();
        String startTime = normalizeTime(req.getStartTime());
        String endTime = normalizeTime(req.getEndTime());
        if (startTime == null) startTime = "09:00:00";
        if (endTime == null) endTime = "11:00:00";

        StudyScheduleVO vo = StudyScheduleVO.builder()
                .subjectId(subjectId)
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .startTime(startTime)
                .endTime(endTime)
                .description(req.getDescription() != null ? req.getDescription() : "")
                .build();

        try {
            studyScheduleMapper.insert(vo);
            // schedule_id = round_num 이므로 생성된 ID가 아닌 회차 번호 반환
            return Long.valueOf(req.getRound());
        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException(
                    "이미 해당 과목의 " + req.getRound() + "회차 일정이 등록되어 있습니다. 다른 회차를 선택하세요.");
        }
    }

    @Override
    @Transactional
    public void update(Long studyScheduleId, String roomId, StudyScheduleUpdateRequest req) {
        String startTime = normalizeTime(req.getStartTime());
        String endTime = normalizeTime(req.getEndTime());

        StudyScheduleVO vo = StudyScheduleVO.builder()
                .studyScheduleId(studyScheduleId)
                .subjectId(roomId)
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .startTime(startTime)
                .endTime(endTime)
                .description(req.getDescription() != null ? req.getDescription() : "")
                .build();

        int updated = studyScheduleMapper.update(vo);
        if (updated == 0) {
            throw new IllegalArgumentException("해당 스터디 일정이 없거나 수정할 수 없습니다. id=" + studyScheduleId);
        }
    }

    @Override
    @Transactional
    public void delete(Long studyScheduleId, String roomId) {
        int deleted = studyScheduleMapper.delete(studyScheduleId, roomId);
        if (deleted == 0) {
            throw new IllegalArgumentException("해당 스터디 일정이 없거나 삭제할 수 없습니다. id=" + studyScheduleId);
        }
    }

    @Override
    @Transactional
    public Long getOrCreateTodayScheduleId(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            throw new IllegalArgumentException("roomId는 필수입니다.");
        }
        LocalDate today = LocalDate.now();
        Date start = Date.valueOf(today);
        Date endExclusive = Date.valueOf(today.plusDays(1));
        try {
            List<StudyScheduleVO> bySubject = studyScheduleMapper.selectBySubjectIdAndRange(roomId, start, endExclusive);
            if (!bySubject.isEmpty()) {
                return bySubject.get(0).getStudyScheduleId();
            }
            StudyScheduleVO vo = StudyScheduleVO.builder()
                    .subjectId(roomId)
                    .roundNum(1)
                    .studyDate(start)
                    .startTime("09:00:00")
                    .endTime("11:00:00")
                    .description("")
                    .build();
            studyScheduleMapper.insertWithSubjectId(vo);
            // schedule_id = round_num 이므로 insert 후 회차 번호(1) 반환
            return vo.getRoundNum() != null ? vo.getRoundNum().longValue() : 1L;
        } catch (Exception e) {
            // fallback
        }
        List<StudyScheduleVO> list = studyScheduleMapper.selectByRange(roomId, start, endExclusive);
        if (!list.isEmpty()) {
            return list.get(0).getStudyScheduleId();
        }
        StudyScheduleVO vo = StudyScheduleVO.builder()
                .subjectId(roomId)
                .roundNum(1)
                .studyDate(start)
                .startTime("09:00:00")
                .endTime("11:00:00")
                .description("")
                .build();
        studyScheduleMapper.insert(vo);
        return vo.getRoundNum() != null ? vo.getRoundNum().longValue() : 1L;
    }

    @Override
    public int getNextRoundNum(String roomId) {
        if (roomId == null || roomId.isBlank()) return 1;
        Integer max = studyScheduleMapper.selectMaxRoundNumBySubjectId(roomId.trim());
        return (max != null && max >= 0) ? max + 1 : 1;
    }

    @Override
    public Long findActiveScheduleIdByCurrentTime(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return null;
        try {
            return studyScheduleMapper.selectScheduleIdBySubjectIdAndCurrentTime(subjectId.trim());
        } catch (Exception e) {
            return null;
        }
    }
}