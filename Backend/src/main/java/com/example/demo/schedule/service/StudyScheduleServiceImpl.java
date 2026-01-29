package com.example.demo.schedule.service;


import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.schedule.mapper.StudyScheduleMapper;
import com.example.demo.schedule.vo.StudyScheduleVO;
import lombok.RequiredArgsConstructor;
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
        return studyScheduleMapper.selectByRange(roomId, start, endExclusive); // :contentReference[oaicite:6]{index=6}
    }

    @Override
    @Transactional
    public Long insert(StudyScheduleCreateRequest req) {
        StudyScheduleVO vo = StudyScheduleVO.builder()
                .roomId(req.getRoomId())
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .description(req.getDescription())
                .build();

        studyScheduleMapper.insert(vo); // :contentReference[oaicite:7]{index=7}
        return vo.getStudyScheduleId();
    }

    @Override
    @Transactional
    public void update(Long studyScheduleId, String roomId, StudyScheduleUpdateRequest req) {
        StudyScheduleVO vo = StudyScheduleVO.builder()
                .studyScheduleId(studyScheduleId)
                .roomId(roomId)
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .description(req.getDescription())
                .build();

        int updated = studyScheduleMapper.update(vo); // :contentReference[oaicite:8]{index=8}
        if (updated == 0) {
            throw new IllegalArgumentException("해당 스터디 일정이 없거나 수정할 수 없습니다. id=" + studyScheduleId);
        }
    }

    @Override
    @Transactional
    public void delete(Long studyScheduleId, String roomId) {
        int deleted = studyScheduleMapper.delete(studyScheduleId, roomId); // :contentReference[oaicite:9]{index=9}
        if (deleted == 0) {
            throw new IllegalArgumentException("해당 스터디 일정이 없거나 삭제할 수 없습니다. id=" + studyScheduleId);
        }
    }
}