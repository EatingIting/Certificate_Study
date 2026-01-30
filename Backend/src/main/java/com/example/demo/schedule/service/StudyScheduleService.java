package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.schedule.vo.StudyScheduleVO;

import java.sql.Date;
import java.util.List;

public interface StudyScheduleService {

    List<StudyScheduleVO> selectByRange(String roomId, Date start, Date endExclusive);

    /** subject_id로 기존 회차 1건 조회 (fallback용) */
    List<StudyScheduleVO> selectAnyBySubjectId(String subjectId);

    Long insert(StudyScheduleCreateRequest req);

    void update(Long studyScheduleId, String roomId, StudyScheduleUpdateRequest req);

    void delete(Long studyScheduleId, String roomId);

    /** 오늘 회차 schedule_id 반환. 없으면 1회차 생성 후 반환. */
    Long getOrCreateTodayScheduleId(String roomId);

    /** 해당 과목의 다음 회차 번호(등록 가능한 최소 회차) 반환. */
    int getNextRoundNum(String roomId);

    /** 현재 시각이 스터디 일정 시간(start_time~end_time) 안에 있으면 해당 회차 schedule_id, 아니면 null */
    Long findActiveScheduleIdByCurrentTime(String subjectId);
}