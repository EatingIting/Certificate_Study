package com.example.demo.schedule.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.ibatis.type.Alias;

import java.sql.Date;
import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Alias("StudyScheduleVO")
public class StudyScheduleVO {
    /** schedule_id BIGINT - DB PK (AUTO_INCREMENT) */
    private Long studyScheduleId;

    private String roomId;   // legacy
    /** LMS subject UUID → study_schedule.subject_id */
    private String subjectId;

    private Integer roundNum;
    private Date studyDate;

    /** 시작 시간 (HH:mm 또는 HH:mm:ss) */
    private String startTime;
    /** 종료 시간 (HH:mm 또는 HH:mm:ss) */
    private String endTime;

    private String description;

    /** DB에 없으면 제거 가능 */
    private Timestamp createdAt;
    private Timestamp updatedAt;
}