package com.example.demo.schedule.service;


import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.schedule.mapper.StudyScheduleMapper;
import com.example.demo.schedule.vo.StudyScheduleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Time;
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
    @Transactional
    public Long insert(StudyScheduleCreateRequest req) {
        Time startTime = Time.valueOf(req.getStartTime() + ":00");
        Time endTime = Time.valueOf(req.getEndTime() + ":00");

        StudyScheduleVO vo = StudyScheduleVO.builder()
                .roomId(req.getRoomId())
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .startTime(startTime)
                .endTime(endTime)
                .description(req.getDescription())
                .build();

        studyScheduleMapper.insert(vo);
        return vo.getStudyScheduleId();
    }

    @Override
    @Transactional
    public void update(Long studyScheduleId, String roomId, StudyScheduleUpdateRequest req) {
        Time startTime = Time.valueOf(req.getStartTime());
        Time endTime = Time.valueOf(req.getEndTime());

        StudyScheduleVO vo = StudyScheduleVO.builder()
                .studyScheduleId(studyScheduleId)
                .roomId(roomId)
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .startTime(startTime)
                .endTime(endTime)
                .description(req.getDescription())
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
}