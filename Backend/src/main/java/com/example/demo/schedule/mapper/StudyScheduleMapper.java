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

    int update(StudyScheduleVO studySchedule);

    int delete(
            @Param("studyScheduleId") Long studyScheduleId,
            @Param("roomId") String roomId
    );
}