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
@Alias("ScheduleVO")
public class ScheduleVO {

    private Long scheduleId;

    private String roomId;   // char(36)
    private String userId;   // char(36)

    private String title;        // varchar(200)
    private String description;  // text (nullable)

    private Date startAt;    // date
    private Date endAt;      // date (inclusive)

    private String type;     // REGISTRATION/EXAM/RESULT/OTHER
    private String colorHex; // varchar(7) ex) #97c793
    private String textColor; // varchar(7) ex) #ffffff (사용자 선택)
    private String customTypeLabel; // nullable

    private Timestamp createdAt;
    private Timestamp updatedAt;
    private Timestamp deletedAt; // soft delete
}