package com.example.demo.classroom;

import lombok.Data;

@Data
public class ClassRoomVO {

    // ✅ URL에 쓸 숫자 식별자(프론트에서 /lms/1 처럼 사용)
    // - DB 컬럼이 아니라 서비스에서 목록 순서대로 주입
    private Integer subjectId;

    private String roomId;
    private String title;
    private String date;
    private String roomImg;
}
