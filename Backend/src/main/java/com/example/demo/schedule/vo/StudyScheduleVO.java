package com.example.demo.schedule.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.ibatis.type.Alias;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Alias("StudyScheduleVO")
public class StudyScheduleVO {
    private Long studyScheduleId;

    private String roomId;   // char(36)

    private Integer roundNum; // int
    private Date studyDate;   // date

    private Time startTime;   // time
    private Time endTime;     // time

    private String description; // varchar(500) nullable

    private Timestamp createdAt; // datetime지만 Timestamp로 매핑해도 보통 문제 없음
    private Timestamp updatedAt;
}