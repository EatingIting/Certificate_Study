package com.example.demo.schedule.mapper;

import com.example.demo.schedule.vo.StudyScheduleVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.sql.Date;
import java.util.List;

@Mapper
public interface StudyScheduleMapper {

    // 범위 조회 (study_date between start and endInclusive)
    List<StudyScheduleVO> selectByRange(
            @Param("roomId") String roomId,
            @Param("start") Date start,
            @Param("endExclusive") Date endExclusive
    );

    int insert(StudyScheduleVO studySchedule);

    /** subject_id 컬럼으로 조회 (LMS subject UUID) */
    List<StudyScheduleVO> selectBySubjectIdAndRange(
            @Param("subjectId") String subjectId,
            @Param("start") Date start,
            @Param("endExclusive") Date endExclusive
    );

    /** subject_id로 기존 회차 1건 조회 (fallback용) */
    List<StudyScheduleVO> selectAnyBySubjectId(@Param("subjectId") String subjectId);

    /** 해당 과목의 최대 회차 번호 (다음 회차 제안용) */
    Integer selectMaxRoundNumBySubjectId(@Param("subjectId") String subjectId);

    /** 현재 시각이 스터디 일정 시간대 안에 있는 회차의 schedule_id. 없으면 null */
    Long selectScheduleIdBySubjectIdAndCurrentTime(@Param("subjectId") String subjectId);

    /** subject_id 컬럼으로 삽입 */
    int insertWithSubjectId(StudyScheduleVO vo);

    int update(StudyScheduleVO studySchedule);

    int delete(
            @Param("studyScheduleId") Long studyScheduleId,
            @Param("roomId") String roomId
    );
}