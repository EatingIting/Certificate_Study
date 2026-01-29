package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.schedule.vo.StudyScheduleVO;

import java.sql.Date;
import java.util.List;

public interface StudyScheduleService {

    List<StudyScheduleVO> selectByRange(String roomId, Date start, Date endExclusive);

    Long insert(StudyScheduleCreateRequest req);

    void update(Long studyScheduleId, String roomId, StudyScheduleUpdateRequest req);

    void delete(Long studyScheduleId, String roomId);
}