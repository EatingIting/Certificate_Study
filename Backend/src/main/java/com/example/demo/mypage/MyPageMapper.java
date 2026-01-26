package com.example.demo.mypage;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface MyPageMapper {

    MyPageVO findByUserId(@Param("userId") String userId);

    void updateMyPage(
            @Param("userId") String userId,
            @Param("name") String name,
            @Param("nickname") String nickname,
            @Param("birthDate") LocalDate birthDate,
            @Param("gender") String gender,
            @Param("introduction") String introduction,
            @Param("profileImg") String profileImg
    );

    void deleteByEmail(@Param("email") String email);

    String getGender(@Param("email") String email);

    List<MyStudyVO> getJoinedStudies(
            @Param("email") String email,
            @Param("today") LocalDate today
    );

    // 완료된 스터디 (종료일이 오늘 이전)
    List<MyStudyVO> getCompletedStudies(
            @Param("email") String email,
            @Param("today") LocalDate today
    );

    List<MyStudyVO> getJoinedStudies(String email);

    List<MyStudyVO> getCompletedStudies(String email);
}
