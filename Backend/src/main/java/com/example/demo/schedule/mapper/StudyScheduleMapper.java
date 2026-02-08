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

    /** 오늘 일정 중 start_time >= 현재 시각인 가장 가까운 회차의 schedule_id. 없으면 null */
    Long selectUpcomingTodayScheduleId(@Param("subjectId") String subjectId);

    /** 오늘(CURDATE) 일정이 하나라도 있으면 가장 빠른 회차의 schedule_id. 없으면 null */
    Long selectAnyTodayScheduleId(@Param("subjectId") String subjectId);

    /** subject_id + schedule_id로 회차 1건 조회 (오늘 여부 무관) */
    StudyScheduleVO selectBySubjectIdAndScheduleId(
            @Param("subjectId") String subjectId,
            @Param("scheduleId") Long scheduleId);

    /** 오늘 일정 중 schedule_id가 afterScheduleId 보다 큰 가장 가까운 회차 (다음 회차) */
    StudyScheduleVO selectNextSessionToday(
            @Param("subjectId") String subjectId,
            @Param("afterScheduleId") Long afterScheduleId);

    /** 해당 study_date 일정 중 schedule_id가 afterScheduleId 보다 큰 가장 가까운 회차 (캐치업 시 CURDATE 대신 사용) */
    StudyScheduleVO selectNextSessionOnDate(
            @Param("subjectId") String subjectId,
            @Param("studyDate") java.sql.Date studyDate,
            @Param("afterScheduleId") Long afterScheduleId);

    /** subject_id 컬럼으로 삽입 */
    int insertWithSubjectId(StudyScheduleVO vo);

    int update(StudyScheduleVO studySchedule);

    int delete(
            @Param("studyScheduleId") Long studyScheduleId,
            @Param("roomId") String roomId
    );
}
